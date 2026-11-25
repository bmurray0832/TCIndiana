/** Pull constituents, gifts and interactions from Bloomerang into this
 *  CRM. One direction only: Bloomerang stays the system of record for
 *  donors and giving; this app adds prospects and the follow-up layer
 *  on top. Nothing is ever written back to Bloomerang.
 *
 *  Incremental by default: each run asks for records modified since the
 *  previous successful run (with a small overlap), so the nightly job
 *  is a handful of requests. `full: true` re-reads everything and is
 *  safe to repeat — every write is an upsert on the Bloomerang ID.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  applyConstituents,
  applyInteractions,
  applyTransactions,
  type ApplyResult,
  type Invalid,
  type TransactionRecord,
} from "@/lib/import/apply";
import { pages, type Fetcher } from "./client";
import {
  apiDate,
  isPersonalInteraction,
  mapConstituent,
  mapInteraction,
  mapTransaction,
  type ApiConstituent,
  type ApiInteraction,
  type ApiTransaction,
} from "./map";

const OVERLAP_MS = 10 * 60 * 1000;
export const SYNC_LABEL = "Bloomerang API sync";

type Counts = Pick<ApplyResult, "created" | "updated" | "skipped" | "errors">;

export type SyncSummary =
  | {
      ok: true;
      full: boolean;
      constituents: Omit<Counts, "errors">;
      transactions: Omit<Counts, "errors">;
      interactions: Omit<Counts, "errors">;
      errorCount: number;
      ranAt: string;
    }
  | { ok: false; error: string };

const zero = (): Counts => ({ created: 0, updated: 0, skipped: 0, errors: [] });

function add(total: Counts, part: ApplyResult) {
  total.created += part.created;
  total.updated += part.updated;
  total.skipped += part.skipped;
  for (const e of part.errors) if (total.errors.length < 200) total.errors.push(e);
}

const running = new Set<string>();

export async function runBloomerangSync(opts: {
  organizationId: string;
  userId?: string | null;
  full?: boolean;
  fetcher?: Fetcher;
}): Promise<SyncSummary> {
  if (running.has(opts.organizationId)) return { ok: false, error: "A sync is already running." };
  running.add(opts.organizationId);
  try {
    return await sync(opts);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  } finally {
    running.delete(opts.organizationId);
  }
}

async function sync(opts: {
  organizationId: string;
  userId?: string | null;
  full?: boolean;
  fetcher?: Fetcher;
}): Promise<SyncSummary> {
  const org = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    include: { centers: { select: { id: true } } },
  });
  if (!org) return { ok: false, error: "Organization not found." };
  const centerIds = org.centers.map((c) => c.id);
  const centerId = org.bloomerangDefaultCenterId;
  if (!centerId || !centerIds.includes(centerId)) {
    return { ok: false, error: "Choose which center new Bloomerang constituents should land in first." };
  }

  const startedAt = new Date();
  const full = !!opts.full || !org.bloomerangLastSyncAt;
  const since = full ? undefined : new Date(org.bloomerangLastSyncAt!.getTime() - OVERLAP_MS);
  const lastModified = since?.toISOString();
  const scope = { organizationId: org.id, accessibleCenterIds: centerIds, dryRun: false };

  const constituents = zero();
  for await (const page of pages<ApiConstituent>(
    "/constituents",
    { lastModified, orderBy: "Id", orderDirection: "Asc" },
    opts.fetcher,
  )) {
    add(constituents, await applyConstituents(page.map(mapConstituent), { ...scope, centerId, reassignCenter: false }));
  }

  const transactions = zero();
  for await (const page of pages<ApiTransaction>(
    "/transactions",
    { lastModified, orderBy: "CreatedDate", orderDirection: "Asc" },
    opts.fetcher,
  )) {
    const records: (TransactionRecord | Invalid)[] = [];
    const refundedIds: string[] = [];
    for (const t of page) {
      const mapped = mapTransaction(t);
      records.push(...mapped.records);
      refundedIds.push(...mapped.refundedIds);
    }
    add(transactions, await applyTransactions(records, { ...scope, refundedIds }));
  }

  // The interactions endpoint has no lastModified filter, so read newest
  // changes first and stop at the first page that predates the cursor.
  const interactions = zero();
  for await (const page of pages<ApiInteraction>(
    "/interactions",
    { orderBy: "LastModifiedDate", orderDirection: "Desc" },
    opts.fetcher,
  )) {
    const fresh = since
      ? page.filter((i) => (apiDate(i.AuditTrail?.LastModifiedDate) ?? startedAt) >= since)
      : page;
    add(interactions, await applyInteractions(fresh.filter(isPersonalInteraction).map(mapInteraction), scope));
    if (fresh.length < page.length) break;
  }

  const log = (kind: "CONSTITUENTS" | "TRANSACTIONS" | "INTERACTIONS", c: Counts) => ({
    organizationId: org.id,
    userId: opts.userId ?? null,
    kind,
    filename: SYNC_LABEL,
    centerId: kind === "CONSTITUENTS" ? centerId : null,
    created: c.created,
    updated: c.updated,
    skipped: c.skipped,
    errorRows: c.errors as unknown as Prisma.InputJsonValue,
  });
  await prisma.$transaction([
    prisma.bloomerangImport.createMany({
      data: [log("CONSTITUENTS", constituents), log("TRANSACTIONS", transactions), log("INTERACTIONS", interactions)],
    }),
    prisma.organization.update({ where: { id: org.id }, data: { bloomerangLastSyncAt: startedAt } }),
  ]);

  const strip = ({ created, updated, skipped }: Counts) => ({ created, updated, skipped });
  return {
    ok: true,
    full,
    constituents: strip(constituents),
    transactions: strip(transactions),
    interactions: strip(interactions),
    errorCount: constituents.errors.length + transactions.errors.length + interactions.errors.length,
    ranAt: startedAt.toISOString(),
  };
}
