"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { authorize, getCenterIdsWhereCan, getCurrentUser } from "@/lib/auth";
import {
  applyConstituents,
  applyInteractions,
  applyTransactions,
  type ApplyResult,
  type ConstituentRecord,
  type InteractionRecord,
  type Invalid,
  type TransactionRecord,
} from "@/lib/import/apply";
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

type Actor = { id: string; organizationId: string };

/** Record the run in import history and shape the wizard's response. */
async function finish(
  input: ImportInput,
  user: Actor,
  kind: "CONSTITUENTS" | "TRANSACTIONS" | "INTERACTIONS",
  res: ApplyResult,
  paths: string[],
): Promise<ImportResult> {
  if (!input.dryRun) {
    await prisma.bloomerangImport.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind,
        filename: input.filename,
        centerId: kind === "CONSTITUENTS" ? input.centerId : null,
        created: res.created,
        updated: res.updated,
        skipped: res.skipped,
        errorRows: res.errors.slice(0, 200) as unknown as Prisma.InputJsonValue,
      },
    });
    for (const p of [...paths, "/import"]) revalidatePath(p);
  }
  return {
    ok: true,
    dryRun: input.dryRun,
    created: res.created,
    updated: res.updated,
    skipped: res.skipped,
    errors: res.errors.slice(0, 50),
    sampleCreated: res.sample,
  };
}

async function importConstituents(input: ImportInput, user: Actor): Promise<ImportResult> {
  if (!input.centerId) return { ok: false, error: "Pick a center for the constituent import." };

  const gate = await authorize(input.centerId, "import:run");
  if (!gate.ok) return gate;
  const accessible = await getCenterIdsWhereCan("import:run");

  const records = input.rows.map((row): ConstituentRecord | Invalid => {
    const get = (key: string) => val(row, input.mapping, key);
    const bloomerangId = trimStr(get("bloomerangId"));
    const firstName = trimStr(get("firstName"));
    const lastName = trimStr(get("lastName"));
    if (!bloomerangId) return { invalid: "Missing Constituent ID" };
    if (!firstName || !lastName) return { invalid: "Missing first or last name", bloomerangId };
    return {
      bloomerangId,
      firstName,
      lastName,
      email: trimStr(get("email")),
      phone: trimStr(get("phone")),
      organization: trimStr(get("organization")),
      donorStatus: mapDonorStatus(get("donorStatus")),
      dateAdded: parseDate(get("dateAdded")),
      lastContactAt: parseDate(get("lastContactAt")),
      lastGiftDate: parseDate(get("lastGiftDate")),
      lifetimeAmount: parseAmount(get("lifetimeAmount")),
      notes: trimStr(get("notes")),
    };
  });

  const res = await applyConstituents(records, {
    organizationId: user.organizationId,
    accessibleCenterIds: accessible,
    dryRun: input.dryRun,
    centerId: input.centerId,
    reassignCenter: true,
  });
  return finish(input, user, "CONSTITUENTS", res, ["/donors", "/prospects"]);
}

async function importTransactions(input: ImportInput, user: Actor): Promise<ImportResult> {
  const records = input.rows.map((row): TransactionRecord | Invalid => {
    const get = (key: string) => val(row, input.mapping, key);
    const bloomerangId = trimStr(get("bloomerangId"));
    const constituentBloomerangId = trimStr(get("constituentBloomerangId"));
    const date = parseDate(get("date"));
    const amount = parseAmount(get("amount"));
    if (!bloomerangId) return { invalid: "Missing Transaction ID" };
    if (!constituentBloomerangId) return { invalid: "Missing Constituent ID", bloomerangId };
    if (!date || amount === null) return { invalid: "Missing date or amount", bloomerangId };
    return {
      bloomerangId,
      constituentBloomerangId,
      date,
      amount,
      paymentMethod: mapPaymentMethod(get("paymentMethod")),
      campaignName: trimStr(get("campaignName")),
      notes: trimStr(get("notes")),
    };
  });

  const res = await applyTransactions(records, {
    organizationId: user.organizationId,
    accessibleCenterIds: await getCenterIdsWhereCan("import:run"),
    dryRun: input.dryRun,
  });
  return finish(input, user, "TRANSACTIONS", res, ["/donations", "/donors", "/dashboard"]);
}

async function importInteractions(input: ImportInput, user: Actor): Promise<ImportResult> {
  const records = input.rows.map((row): InteractionRecord | Invalid => {
    const get = (key: string) => val(row, input.mapping, key);
    const bloomerangId = trimStr(get("bloomerangId"));
    const constituentBloomerangId = trimStr(get("constituentBloomerangId"));
    const date = parseDate(get("date"));
    if (!bloomerangId || !constituentBloomerangId || !date) {
      return { invalid: "Missing ID, constituent ID, or date", bloomerangId: bloomerangId ?? undefined };
    }
    return {
      bloomerangId,
      constituentBloomerangId,
      date,
      contactType: mapContactType(get("channel")),
      notes: [trimStr(get("purpose")), trimStr(get("notes"))].filter(Boolean).join(" — ") || null,
    };
  });

  const res = await applyInteractions(records, {
    organizationId: user.organizationId,
    accessibleCenterIds: await getCenterIdsWhereCan("import:run"),
    dryRun: input.dryRun,
  });
  return finish(input, user, "INTERACTIONS", res, ["/contacts", "/dashboard"]);
}
