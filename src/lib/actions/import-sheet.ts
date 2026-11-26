"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/auth";
import { recomputePerson } from "@/lib/recompute";
import { mapPaymentMethod } from "@/lib/import/normalize";
import { giftIdentity, groupDonors, nameKey, splitName, zip5, type SheetGift } from "@/lib/import/sheet";

export type SheetImportResult =
  | {
      ok: true;
      dryRun: boolean;
      giftsNew: number;
      giftsAlreadyLoaded: number;
      donorsNew: number;
      donorsMatched: number;
      total: number;
    }
  | { ok: false; error: string };

const MAX_GIFTS = 20_000;

/** Load a donation spreadsheet (already parsed in the browser by
 *  lib/import/sheet.ts) into one center.
 *
 *  Donors are matched to people already in that center by email, then
 *  by name where the ZIP codes don't conflict; anyone unmatched is
 *  created. Matching never crosses centers. An existing person only has
 *  blank fields filled in — nothing staff entered is overwritten.
 *  Gifts carry a derived key, so loading the same file twice adds
 *  nothing the second time. */
export async function importDonationSheet(input: {
  centerId: string;
  filename: string;
  gifts: SheetGift[];
  dryRun: boolean;
}): Promise<SheetImportResult> {
  const gate = await authorize(input.centerId, "import:run");
  if (!gate.ok) return gate;
  const me = gate.user;
  const { centerId } = input;

  if (!Array.isArray(input.gifts) || input.gifts.length === 0) return { ok: false, error: "No gifts found in that file." };
  if (input.gifts.length > MAX_GIFTS) return { ok: false, error: `That file has more than ${MAX_GIFTS.toLocaleString("en-US")} gifts. Split it and try again.` };
  // The rows came from the browser: re-check the fields we rely on.
  for (const g of input.gifts) {
    if (
      typeof g?.name !== "string" || !g.name.trim() ||
      typeof g.amount !== "number" || !Number.isFinite(g.amount) || g.amount <= 0 ||
      typeof g.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(g.date) || isNaN(Date.parse(g.date))
    ) {
      return { ok: false, error: "That file couldn't be read. Re-upload it and try again." };
    }
  }

  const keys = giftIdentity(centerId, input.gifts).map((id) => "sheet:" + crypto.createHash("sha256").update(id).digest("hex").slice(0, 40));
  const keyOf = new Map(input.gifts.map((g, i) => [g, keys[i]]));
  const loaded = new Set(
    (await prisma.donation.findMany({ where: { importKey: { in: keys } }, select: { importKey: true } })).map((d) => d.importKey!),
  );

  // Everyone already in this center, indexed the two ways we match.
  const people = await prisma.person.findMany({
    where: { centerId },
    select: { id: true, firstName: true, lastName: true, organization: true, email: true, phone: true, street: true, city: true, state: true, postalCode: true, doNotMail: true },
  });
  const byEmail = new Map(people.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]));
  const byName = new Map<string, typeof people>();
  for (const p of people) {
    for (const k of new Set([nameKey(`${p.firstName} ${p.lastName}`), p.organization ? nameKey(p.organization) : ""])) {
      if (k) byName.set(k, [...(byName.get(k) ?? []), p]);
    }
  }

  const donors = groupDonors(input.gifts);
  let giftsNew = 0, donorsNew = 0, donorsMatched = 0, total = 0;
  const campaignIds = new Map<string, string>();

  async function campaignIdFor(name: string) {
    const cached = campaignIds.get(name);
    if (cached) return cached;
    const found =
      (await prisma.campaign.findFirst({ where: { organizationId: me.organizationId, name } })) ??
      (await prisma.campaign.create({ data: { organizationId: me.organizationId, name } }));
    campaignIds.set(name, found.id);
    return found.id;
  }

  for (const donor of donors) {
    const fresh = donor.gifts.filter((g) => !loaded.has(keyOf.get(g)!));
    const candidates = byName.get(nameKey(donor.name)) ?? [];
    const match =
      (donor.email ? byEmail.get(donor.email) : undefined) ??
      // A name match only counts when it is unambiguous and nothing contradicts it.
      (candidates.length === 1 &&
      !(candidates[0].email && donor.email && candidates[0].email.toLowerCase() !== donor.email) &&
      !(zip5(candidates[0].postalCode) && zip5(donor.postalCode) && zip5(candidates[0].postalCode) !== zip5(donor.postalCode))
        ? candidates[0]
        : undefined);

    if (match) donorsMatched++;
    else donorsNew++;
    giftsNew += fresh.length;
    total += fresh.reduce((s, g) => s + g.amount, 0);
    if (input.dryRun) continue;

    await prisma.$transaction(async (tx) => {
      let personId: string;
      if (match) {
        personId = match.id;
        await tx.person.update({
          where: { id: match.id },
          data: {
            email: match.email ?? donor.email,
            phone: match.phone ?? donor.phone,
            // An address is taken whole or not at all.
            ...(match.street ? {} : { street: donor.street, city: match.city ?? donor.city, state: match.state ?? donor.state, postalCode: match.postalCode ?? donor.postalCode }),
            doNotMail: match.doNotMail || donor.doNotMail,
          },
        });
      } else {
        const made = await tx.person.create({
          data: {
            centerId,
            ...splitName(donor.name),
            email: donor.email,
            phone: donor.phone,
            street: donor.street,
            city: donor.city,
            state: donor.state,
            postalCode: donor.postalCode,
            doNotMail: donor.doNotMail,
            dateAdded: new Date(`${donor.gifts[0].date}T00:00:00Z`),
          },
          select: { id: true },
        });
        personId = made.id;
      }
      for (const g of fresh) {
        const campaign = g.campaign ?? g.fund;
        await tx.donation.create({
          data: {
            importKey: keyOf.get(g)!,
            personId,
            centerId,
            date: new Date(`${g.date}T00:00:00Z`),
            amount: new Prisma.Decimal(g.amount),
            paymentMethod: mapPaymentMethod(g.method),
            campaignId: campaign ? await campaignIdFor(campaign) : null,
            notes: g.note,
            source: "IMPORTED",
            receiptSent: true, // receipted in the system the export came from
            thankYouSent: true,
          },
        });
      }
      if (fresh.length) await recomputePerson(tx, personId);
    });
  }

  if (!input.dryRun) {
    await prisma.bloomerangImport.create({
      data: {
        organizationId: me.organizationId,
        userId: me.id,
        kind: "TRANSACTIONS",
        filename: String(input.filename).slice(0, 200),
        centerId,
        created: giftsNew,
        updated: 0,
        skipped: input.gifts.length - giftsNew,
      },
    });
    for (const p of ["/import", "/donations", "/donors", "/dashboard", "/reports/year-end"]) revalidatePath(p);
  }

  return {
    ok: true,
    dryRun: input.dryRun,
    giftsNew,
    giftsAlreadyLoaded: input.gifts.length - giftsNew,
    donorsNew,
    donorsMatched,
    total: Math.round(total * 100) / 100,
  };
}
