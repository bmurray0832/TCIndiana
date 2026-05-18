"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  getAccessibleCenterIds,
  requireWriteAccess,
} from "@/lib/auth-dev";
import { recomputePerson } from "@/lib/recompute";
import type { ImportInput, ImportResult, Mapping } from "@/lib/import/types";
import {
  mapContactType,
  mapDonorStatus,
  mapPaymentMethod,
  parseAmount,
  parseDate,
  trimStr,
} from "@/lib/import/normalize";

function val(row: Record<string, unknown>, mapping: Mapping, key: string): unknown {
  const src = mapping[key];
  if (!src) return undefined;
  return row[src];
}

export async function processImport(input: ImportInput): Promise<ImportResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  switch (input.kind) {
    case "constituents":
      return importConstituents(input, user);
    case "transactions":
      return importTransactions(input, user);
    case "interactions":
      return importInteractions(input, user);
    default:
      return { ok: false, error: "Unknown import kind" };
  }
}

async function importConstituents(
  input: ImportInput,
  user: { id: string; organizationId: string },
): Promise<ImportResult> {
  if (!input.centerId) return { ok: false, error: "Pick a center for the constituent import." };

  const accessible = await getAccessibleCenterIds();
  if (!accessible.includes(input.centerId)) {
    return { ok: false, error: "You don't have access to that center." };
  }
  await requireWriteAccess(input.centerId);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorList: { rowIndex: number; bloomerangId?: string; message: string }[] = [];
  const sample: { firstName?: string; lastName?: string }[] = [];

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const bloomerangId = trimStr(val(row, input.mapping, "bloomerangId"));
    const firstName = trimStr(val(row, input.mapping, "firstName"));
    const lastName = trimStr(val(row, input.mapping, "lastName"));

    if (!bloomerangId) {
      errorList.push({ rowIndex: i, message: "Missing Constituent ID" });
      skipped++;
      continue;
    }
    if (!firstName || !lastName) {
      errorList.push({ rowIndex: i, bloomerangId, message: "Missing first or last name" });
      skipped++;
      continue;
    }

    const dateAdded = parseDate(val(row, input.mapping, "dateAdded")) ?? new Date();
    const lastContactAt = parseDate(val(row, input.mapping, "lastContactAt"));
    const lastGiftDate = parseDate(val(row, input.mapping, "lastGiftDate"));
    const lifetime = parseAmount(val(row, input.mapping, "lifetimeAmount"));
    const donorStatus = mapDonorStatus(val(row, input.mapping, "donorStatus"));
    const isDonor = !!(lastGiftDate || (lifetime && lifetime > 0) || donorStatus);

    if (!input.dryRun) {
      const existing = await prisma.person.findUnique({ where: { bloomerangId } });
      if (existing) {
        await prisma.person.update({
          where: { bloomerangId },
          data: {
            firstName,
            lastName,
            centerId: input.centerId,
            email: trimStr(val(row, input.mapping, "email")),
            phone: trimStr(val(row, input.mapping, "phone")),
            organization: trimStr(val(row, input.mapping, "organization")),
            donorStatus: donorStatus ?? existing.donorStatus,
            lastContactAt: lastContactAt ?? existing.lastContactAt,
            lastDonationAt: lastGiftDate ?? existing.lastDonationAt,
            notes: trimStr(val(row, input.mapping, "notes")) ?? existing.notes,
            convertedToDonorAt: existing.convertedToDonorAt ?? (isDonor ? (lastGiftDate ?? dateAdded) : null),
          },
        });
        updated++;
      } else {
        await prisma.person.create({
          data: {
            bloomerangId,
            centerId: input.centerId,
            firstName,
            lastName,
            email: trimStr(val(row, input.mapping, "email")),
            phone: trimStr(val(row, input.mapping, "phone")),
            organization: trimStr(val(row, input.mapping, "organization")),
            donorStatus: donorStatus ?? (isDonor ? "ACTIVE" : null),
            dateAdded,
            lastContactAt,
            lastDonationAt: lastGiftDate,
            notes: trimStr(val(row, input.mapping, "notes")),
            convertedToDonorAt: isDonor ? (lastGiftDate ?? dateAdded) : null,
            lifetimeAmount: lifetime ? new Prisma.Decimal(lifetime) : new Prisma.Decimal(0),
          },
        });
        created++;
      }
    } else {
      const existing = await prisma.person.findUnique({ where: { bloomerangId } });
      if (existing) updated++;
      else {
        created++;
        if (sample.length < 5) sample.push({ firstName, lastName });
      }
    }
  }

  if (!input.dryRun) {
    await prisma.bloomerangImport.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: "CONSTITUENTS",
        filename: input.filename,
        centerId: input.centerId,
        created,
        updated,
        skipped,
        errorRows: errorList.slice(0, 200) as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/donors");
    revalidatePath("/prospects");
    revalidatePath("/import");
  }

  return { ok: true, dryRun: input.dryRun, created, updated, skipped, errors: errorList.slice(0, 50), sampleCreated: sample };
}

async function importTransactions(
  input: ImportInput,
  user: { id: string; organizationId: string },
): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorList: { rowIndex: number; bloomerangId?: string; message: string }[] = [];
  const sample: { firstName?: string; lastName?: string; amount?: number; date?: string }[] = [];
  const accessible = await getAccessibleCenterIds();

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const bloomerangId = trimStr(val(row, input.mapping, "bloomerangId"));
    const constituentBloomerangId = trimStr(val(row, input.mapping, "constituentBloomerangId"));
    const date = parseDate(val(row, input.mapping, "date"));
    const amount = parseAmount(val(row, input.mapping, "amount"));

    if (!bloomerangId) {
      errorList.push({ rowIndex: i, message: "Missing Transaction ID" });
      skipped++; continue;
    }
    if (!constituentBloomerangId) {
      errorList.push({ rowIndex: i, bloomerangId, message: "Missing Constituent ID" });
      skipped++; continue;
    }
    if (!date || amount === null) {
      errorList.push({ rowIndex: i, bloomerangId, message: "Missing date or amount" });
      skipped++; continue;
    }

    const person = await prisma.person.findUnique({ where: { bloomerangId: constituentBloomerangId } });
    if (!person) {
      errorList.push({ rowIndex: i, bloomerangId, message: `No constituent found with ID ${constituentBloomerangId}. Import Constituents first.` });
      skipped++; continue;
    }
    if (!accessible.includes(person.centerId)) {
      errorList.push({ rowIndex: i, bloomerangId, message: "No access to this person's center" });
      skipped++; continue;
    }

    const campaignName = trimStr(val(row, input.mapping, "campaignName"));
    const paymentMethod = mapPaymentMethod(val(row, input.mapping, "paymentMethod"));
    const notes = trimStr(val(row, input.mapping, "notes"));

    if (input.dryRun) {
      const existing = await prisma.donation.findUnique({ where: { bloomerangId } });
      if (existing) updated++;
      else {
        created++;
        if (sample.length < 5) sample.push({
          firstName: person.firstName,
          lastName: person.lastName,
          amount,
          date: date.toISOString().slice(0, 10),
        });
      }
      continue;
    }

    let campaignId: string | null = null;
    if (campaignName) {
      const existing = await prisma.campaign.findFirst({
        where: { organizationId: user.organizationId, name: campaignName },
      });
      if (existing) {
        campaignId = existing.id;
      } else {
        const made = await prisma.campaign.create({
          data: { organizationId: user.organizationId, name: campaignName },
        });
        campaignId = made.id;
      }
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.donation.findUnique({ where: { bloomerangId } });
      if (existing) {
        await tx.donation.update({
          where: { bloomerangId },
          data: {
            personId: person.id,
            centerId: person.centerId,
            date,
            amount: new Prisma.Decimal(amount),
            paymentMethod,
            campaignId,
            notes,
            source: "IMPORTED",
          },
        });
        updated++;
      } else {
        await tx.donation.create({
          data: {
            bloomerangId,
            personId: person.id,
            centerId: person.centerId,
            date,
            amount: new Prisma.Decimal(amount),
            paymentMethod,
            campaignId,
            notes,
            source: "IMPORTED",
            receiptSent: true, // Bloomerang would have already sent these
            thankYouSent: true,
          },
        });
        created++;
      }
      await recomputePerson(tx, person.id);
    });
  }

  if (!input.dryRun) {
    await prisma.bloomerangImport.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: "TRANSACTIONS",
        filename: input.filename,
        created,
        updated,
        skipped,
        errorRows: errorList.slice(0, 200) as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/donations");
    revalidatePath("/donors");
    revalidatePath("/dashboard");
    revalidatePath("/import");
  }

  return { ok: true, dryRun: input.dryRun, created, updated, skipped, errors: errorList.slice(0, 50), sampleCreated: sample };
}

async function importInteractions(
  input: ImportInput,
  user: { id: string; organizationId: string },
): Promise<ImportResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorList: { rowIndex: number; bloomerangId?: string; message: string }[] = [];
  const accessible = await getAccessibleCenterIds();

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const bloomerangId = trimStr(val(row, input.mapping, "bloomerangId"));
    const constituentBloomerangId = trimStr(val(row, input.mapping, "constituentBloomerangId"));
    const date = parseDate(val(row, input.mapping, "date"));

    if (!bloomerangId || !constituentBloomerangId || !date) {
      errorList.push({ rowIndex: i, bloomerangId: bloomerangId ?? undefined, message: "Missing ID, constituent ID, or date" });
      skipped++; continue;
    }

    const person = await prisma.person.findUnique({ where: { bloomerangId: constituentBloomerangId } });
    if (!person) {
      errorList.push({ rowIndex: i, bloomerangId, message: `No constituent found with ID ${constituentBloomerangId}.` });
      skipped++; continue;
    }
    if (!accessible.includes(person.centerId)) {
      errorList.push({ rowIndex: i, bloomerangId, message: "No access to this person's center" });
      skipped++; continue;
    }

    const channel = val(row, input.mapping, "channel");
    const notes = [
      trimStr(val(row, input.mapping, "purpose")),
      trimStr(val(row, input.mapping, "notes")),
    ].filter(Boolean).join(" — ") || null;

    if (input.dryRun) {
      const existing = await prisma.contact.findUnique({ where: { bloomerangId } });
      if (existing) updated++;
      else created++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.contact.findUnique({ where: { bloomerangId } });
      if (existing) {
        await tx.contact.update({
          where: { bloomerangId },
          data: {
            personId: person.id,
            centerId: person.centerId,
            date,
            contactType: mapContactType(channel),
            outcome: "OTHER",
            notes,
          },
        });
        updated++;
      } else {
        await tx.contact.create({
          data: {
            bloomerangId,
            personId: person.id,
            centerId: person.centerId,
            date,
            contactType: mapContactType(channel),
            outcome: "OTHER",
            notes,
          },
        });
        created++;
      }
      await recomputePerson(tx, person.id);
    });
  }

  if (!input.dryRun) {
    await prisma.bloomerangImport.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: "INTERACTIONS",
        filename: input.filename,
        created,
        updated,
        skipped,
        errorRows: errorList.slice(0, 200) as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    revalidatePath("/import");
  }

  return { ok: true, dryRun: input.dryRun, created, updated, skipped, errors: errorList.slice(0, 50) };
}

