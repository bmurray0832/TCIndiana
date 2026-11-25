/** The one place Bloomerang data is written to the database.
 *
 *  Both entry points feed this module normalized records:
 *   - the CSV wizard (lib/actions/import.ts) maps spreadsheet rows,
 *   - the direct API sync (lib/bloomerang/sync.ts) maps API objects.
 *
 *  Rules that hold for every caller:
 *   - Records are matched on their Bloomerang ID, so re-runs update
 *     instead of duplicating.
 *   - A record that already belongs to a center outside
 *     `accessibleCenterIds` is never touched. Bloomerang IDs are unique
 *     across the whole database, so this is the tenancy boundary.
 *   - Fields staff own in this app (next step, interest level, snooze,
 *     and — unless `reassignCenter` — the center) are left alone.
 *   - Lookups are batched per chunk and Person aggregates are
 *     recomputed once per touched person, not once per row.
 */

import { Prisma } from "@/generated/prisma";
import type { ContactType, DonorStatus, PaymentMethod } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { recomputePerson } from "@/lib/recompute";

export type ConstituentRecord = {
  bloomerangId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  donorStatus?: DonorStatus | null;
  dateAdded?: Date | null;
  lastContactAt?: Date | null;
  lastGiftDate?: Date | null;
  lifetimeAmount?: number | null;
  notes?: string | null;
  /** Deceased in Bloomerang: kept for giving history, never surfaced
   *  as someone to follow up with. */
  deceased?: boolean;
};

export type TransactionRecord = {
  bloomerangId: string;
  constituentBloomerangId: string;
  date: Date;
  amount: number;
  paymentMethod: PaymentMethod;
  campaignName?: string | null;
  notes?: string | null;
};

export type InteractionRecord = {
  bloomerangId: string;
  constituentBloomerangId: string;
  date: Date;
  contactType: ContactType;
  notes?: string | null;
};

/** A record the caller could not normalize (missing ID, bad date…).
 *  Passed through so row numbers in error reports stay aligned. */
export type Invalid = { invalid: string; bloomerangId?: string };

export type ApplyError = { rowIndex: number; bloomerangId?: string; message: string };

export type ApplyResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: ApplyError[];
  sample: { firstName?: string; lastName?: string; amount?: number; date?: string }[];
};

type Scope = {
  organizationId: string;
  accessibleCenterIds: string[];
  dryRun: boolean;
};

const CHUNK = 200;
const NEVER = new Date("2999-01-01T00:00:00Z");

function emptyResult(): ApplyResult {
  return { created: 0, updated: 0, skipped: 0, errors: [], sample: [] };
}

function isInvalid<T extends object>(r: T | Invalid): r is Invalid {
  return "invalid" in r;
}

function* chunks<T>(items: T[]): Generator<{ offset: number; items: T[] }> {
  for (let offset = 0; offset < items.length; offset += CHUNK) {
    yield { offset, items: items.slice(offset, offset + CHUNK) };
  }
}

async function recomputeAll(personIds: Set<string>) {
  for (const id of personIds) await recomputePerson(prisma, id);
}

export async function applyConstituents(
  records: (ConstituentRecord | Invalid)[],
  opts: Scope & {
    /** Center for constituents that don't exist here yet. */
    centerId: string;
    /** Move existing people into `centerId` (CSV "import into center X").
     *  The API sync passes false so staff reassignments survive. */
    reassignCenter: boolean;
  },
): Promise<ApplyResult> {
  const res = emptyResult();
  if (!opts.accessibleCenterIds.includes(opts.centerId)) {
    throw new Error("Target center is outside the caller's access");
  }

  for (const { offset, items } of chunks(records)) {
    const ids = items.filter((r): r is ConstituentRecord => !isInvalid(r)).map((r) => r.bloomerangId);
    const existing = new Map(
      (await prisma.person.findMany({ where: { bloomerangId: { in: ids } } })).map((p) => [p.bloomerangId!, p]),
    );

    for (let i = 0; i < items.length; i++) {
      const rec = items[i];
      const rowIndex = offset + i;
      if (isInvalid(rec)) {
        res.errors.push({ rowIndex, bloomerangId: rec.bloomerangId, message: rec.invalid });
        res.skipped++;
        continue;
      }
      const prior = existing.get(rec.bloomerangId);
      if (prior && !opts.accessibleCenterIds.includes(prior.centerId)) {
        res.errors.push({
          rowIndex,
          bloomerangId: rec.bloomerangId,
          message: "This constituent belongs to a center you can't edit.",
        });
        res.skipped++;
        continue;
      }

      const isDonor = !!(rec.lastGiftDate || (rec.lifetimeAmount && rec.lifetimeAmount > 0) || rec.donorStatus);

      if (prior) {
        if (!opts.dryRun) {
          await prisma.person.update({
            where: { id: prior.id },
            data: {
              firstName: rec.firstName,
              lastName: rec.lastName,
              centerId: opts.reassignCenter ? opts.centerId : prior.centerId,
              email: rec.email ?? prior.email,
              phone: rec.phone ?? prior.phone,
              organization: rec.organization ?? prior.organization,
              donorStatus: rec.donorStatus ?? prior.donorStatus,
              lastContactAt: rec.lastContactAt ?? prior.lastContactAt,
              lastDonationAt: rec.lastGiftDate ?? prior.lastDonationAt,
              notes: rec.notes ?? prior.notes,
              convertedToDonorAt:
                prior.convertedToDonorAt ?? (isDonor ? (rec.lastGiftDate ?? rec.dateAdded ?? new Date()) : null),
              snoozedUntil: rec.deceased ? NEVER : prior.snoozedUntil,
            },
          });
        }
        res.updated++;
      } else {
        if (!opts.dryRun) {
          const dateAdded = rec.dateAdded ?? new Date();
          const made = await prisma.person.create({
            data: {
              bloomerangId: rec.bloomerangId,
              centerId: opts.centerId,
              firstName: rec.firstName,
              lastName: rec.lastName,
              email: rec.email ?? null,
              phone: rec.phone ?? null,
              organization: rec.organization ?? null,
              donorStatus: rec.donorStatus ?? (isDonor ? "ACTIVE" : null),
              dateAdded,
              lastContactAt: rec.lastContactAt ?? null,
              lastDonationAt: rec.lastGiftDate ?? null,
              lifetimeAmount: new Prisma.Decimal(rec.lifetimeAmount ?? 0),
              notes: rec.notes ?? null,
              convertedToDonorAt: isDonor ? (rec.lastGiftDate ?? dateAdded) : null,
              snoozedUntil: rec.deceased ? NEVER : null,
            },
          });
          existing.set(rec.bloomerangId, made); // a later duplicate row updates
        }
        res.created++;
        if (res.sample.length < 5) res.sample.push({ firstName: rec.firstName, lastName: rec.lastName });
      }
    }
  }
  return res;
}

/** Shared person lookup for records that hang off a constituent. */
async function peopleByBloomerangId(ids: string[]) {
  const rows = await prisma.person.findMany({
    where: { bloomerangId: { in: [...new Set(ids)] } },
    select: { id: true, centerId: true, bloomerangId: true, firstName: true, lastName: true },
  });
  return new Map(rows.map((p) => [p.bloomerangId!, p]));
}

export async function applyTransactions(
  records: (TransactionRecord | Invalid)[],
  opts: Scope & {
    /** Bloomerang IDs of gifts that were refunded there. Any copy we
     *  hold is removed so totals don't overstate. */
    refundedIds?: string[];
  },
): Promise<ApplyResult> {
  const res = emptyResult();
  const touched = new Set<string>();
  const campaignIds = new Map<string, string>();

  async function campaignIdFor(name: string): Promise<string> {
    const cached = campaignIds.get(name);
    if (cached) return cached;
    const found =
      (await prisma.campaign.findFirst({ where: { organizationId: opts.organizationId, name } })) ??
      (await prisma.campaign.create({ data: { organizationId: opts.organizationId, name } }));
    campaignIds.set(name, found.id);
    return found.id;
  }

  for (const { offset, items } of chunks(records)) {
    const valid = items.filter((r): r is TransactionRecord => !isInvalid(r));
    const people = await peopleByBloomerangId(valid.map((r) => r.constituentBloomerangId));
    const existing = new Set(
      (
        await prisma.donation.findMany({
          where: { bloomerangId: { in: valid.map((r) => r.bloomerangId) } },
          select: { bloomerangId: true },
        })
      ).map((d) => d.bloomerangId!),
    );

    for (let i = 0; i < items.length; i++) {
      const rec = items[i];
      const rowIndex = offset + i;
      if (isInvalid(rec)) {
        res.errors.push({ rowIndex, bloomerangId: rec.bloomerangId, message: rec.invalid });
        res.skipped++;
        continue;
      }
      const person = people.get(rec.constituentBloomerangId);
      if (!person) {
        res.errors.push({
          rowIndex,
          bloomerangId: rec.bloomerangId,
          message: `No constituent found with ID ${rec.constituentBloomerangId}. Import Constituents first.`,
        });
        res.skipped++;
        continue;
      }
      if (!opts.accessibleCenterIds.includes(person.centerId)) {
        res.errors.push({ rowIndex, bloomerangId: rec.bloomerangId, message: "No access to this person's center" });
        res.skipped++;
        continue;
      }

      const isUpdate = existing.has(rec.bloomerangId);
      if (!opts.dryRun) {
        const data = {
          personId: person.id,
          centerId: person.centerId,
          date: rec.date,
          amount: new Prisma.Decimal(rec.amount),
          paymentMethod: rec.paymentMethod,
          campaignId: rec.campaignName ? await campaignIdFor(rec.campaignName) : null,
          notes: rec.notes ?? null,
          source: "IMPORTED" as const,
        };
        if (isUpdate) {
          await prisma.donation.update({ where: { bloomerangId: rec.bloomerangId }, data });
        } else {
          await prisma.donation.create({
            // Bloomerang already receipted and thanked these.
            data: { ...data, bloomerangId: rec.bloomerangId, receiptSent: true, thankYouSent: true },
          });
          existing.add(rec.bloomerangId);
        }
        touched.add(person.id);
      }
      if (isUpdate) res.updated++;
      else {
        res.created++;
        if (res.sample.length < 5) {
          res.sample.push({
            firstName: person.firstName,
            lastName: person.lastName,
            amount: rec.amount,
            date: rec.date.toISOString().slice(0, 10),
          });
        }
      }
    }
  }

  if (!opts.dryRun && opts.refundedIds?.length) {
    const stale = await prisma.donation.findMany({
      where: {
        bloomerangId: { in: opts.refundedIds },
        source: "IMPORTED",
        centerId: { in: opts.accessibleCenterIds },
      },
      select: { id: true, personId: true },
    });
    if (stale.length) {
      await prisma.donation.deleteMany({ where: { id: { in: stale.map((d) => d.id) } } });
      for (const d of stale) touched.add(d.personId);
    }
  }

  if (!opts.dryRun) await recomputeAll(touched);
  return res;
}

export async function applyInteractions(
  records: (InteractionRecord | Invalid)[],
  opts: Scope,
): Promise<ApplyResult> {
  const res = emptyResult();
  const touched = new Set<string>();

  for (const { offset, items } of chunks(records)) {
    const valid = items.filter((r): r is InteractionRecord => !isInvalid(r));
    const people = await peopleByBloomerangId(valid.map((r) => r.constituentBloomerangId));
    const existing = new Set(
      (
        await prisma.contact.findMany({
          where: { bloomerangId: { in: valid.map((r) => r.bloomerangId) } },
          select: { bloomerangId: true },
        })
      ).map((c) => c.bloomerangId!),
    );

    for (let i = 0; i < items.length; i++) {
      const rec = items[i];
      const rowIndex = offset + i;
      if (isInvalid(rec)) {
        res.errors.push({ rowIndex, bloomerangId: rec.bloomerangId, message: rec.invalid });
        res.skipped++;
        continue;
      }
      const person = people.get(rec.constituentBloomerangId);
      if (!person) {
        res.errors.push({
          rowIndex,
          bloomerangId: rec.bloomerangId,
          message: `No constituent found with ID ${rec.constituentBloomerangId}.`,
        });
        res.skipped++;
        continue;
      }
      if (!opts.accessibleCenterIds.includes(person.centerId)) {
        res.errors.push({ rowIndex, bloomerangId: rec.bloomerangId, message: "No access to this person's center" });
        res.skipped++;
        continue;
      }

      const isUpdate = existing.has(rec.bloomerangId);
      if (!opts.dryRun) {
        const data = {
          personId: person.id,
          centerId: person.centerId,
          date: rec.date,
          contactType: rec.contactType,
          outcome: "OTHER" as const,
          notes: rec.notes ?? null,
        };
        if (isUpdate) {
          await prisma.contact.update({ where: { bloomerangId: rec.bloomerangId }, data });
        } else {
          await prisma.contact.create({ data: { ...data, bloomerangId: rec.bloomerangId } });
          existing.add(rec.bloomerangId);
        }
        touched.add(person.id);
      }
      if (isUpdate) res.updated++;
      else res.created++;
    }
  }

  if (!opts.dryRun) await recomputeAll(touched);
  return res;
}
