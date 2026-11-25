/** Numbers behind the Giving Breakdown report.
 *
 *  One grouped SQL query per section instead of loading gift rows into
 *  memory, so the report costs the same at 500 gifts or 500,000.
 *
 *  Months are calendar months of the gift date as stored. Imported and
 *  hand-entered gifts carry a date only, so no time-zone shift is
 *  applied — a gift dated March 1 is always a March gift.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type MonthRow = {
  month: string; // "2026-03"
  gifts: number;
  donors: number;
  gross: number;
  online: number;
  recurring: number;
  /** Processor fees on online gifts whose fee is known. */
  fees: number;
  net: number;
};

export type GivingBreakdown = {
  year: number;
  months: MonthRow[];
  totals: Omit<MonthRow, "month">;
  /** Donors with any gift in the year (not the sum of monthly donors). */
  donors: number;
  /** Online gifts where the donor chose to cover the fee. */
  coveredFeeGifts: number;
  onlineGifts: number;
  /** Online gifts still waiting on Stripe to report the fee. */
  feePendingGifts: number;
  /** Fees as a share of online giving whose fee is known, 0–1. */
  effectiveFeeRate: number | null;
  sources: { source: "Online" | "Bloomerang" | "Entered by staff"; gifts: number; gross: number }[];
  /** Donors with a recurring gift in the last 35 days, and what those
   *  gifts add up to — the dependable monthly baseline. */
  recurringNow: { donors: number; monthly: number };
};

const cents = (n: number) => Math.round(n * 100) / 100;

export async function givingBreakdown(centerIds: string[], year: number, now = new Date()): Promise<GivingBreakdown> {
  const empty = { gifts: 0, donors: 0, gross: 0, online: 0, recurring: 0, fees: 0, net: 0 };
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const labels = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  if (centerIds.length === 0) {
    return {
      year,
      months: labels.map((month) => ({ month, ...empty })),
      totals: empty,
      donors: 0,
      coveredFeeGifts: 0,
      onlineGifts: 0,
      feePendingGifts: 0,
      effectiveFeeRate: null,
      sources: [],
      recurringNow: { donors: 0, monthly: 0 },
    };
  }

  const inCenters = Prisma.sql`center_id IN (${Prisma.join(centerIds)})`;
  const inYear = Prisma.sql`date >= ${start} AND date < ${end}`;

  const [monthly, summary, sources, recurring] = await Promise.all([
    prisma.$queryRaw<
      { month: string; gifts: number; donors: number; gross: number; online: number; recurring: number; fees: number }[]
    >(Prisma.sql`
      SELECT to_char(date, 'YYYY-MM') AS month,
             count(*)::int AS gifts,
             count(DISTINCT person_id)::int AS donors,
             coalesce(sum(amount), 0)::float8 AS gross,
             coalesce(sum(amount) FILTER (WHERE source = 'STRIPE'), 0)::float8 AS online,
             coalesce(sum(amount) FILTER (WHERE stripe_subscription_id IS NOT NULL), 0)::float8 AS recurring,
             coalesce(sum(stripe_fees_cents), 0)::float8 / 100 AS fees
      FROM donations
      WHERE ${inCenters} AND ${inYear}
      GROUP BY 1`),
    prisma.$queryRaw<
      { donors: number; online_gifts: number; covered: number; fee_pending: number; fee_base: number }[]
    >(Prisma.sql`
      SELECT count(DISTINCT person_id)::int AS donors,
             count(*) FILTER (WHERE source = 'STRIPE')::int AS online_gifts,
             count(*) FILTER (WHERE source = 'STRIPE' AND donor_covered_fees)::int AS covered,
             count(*) FILTER (WHERE source = 'STRIPE' AND stripe_fees_cents IS NULL)::int AS fee_pending,
             coalesce(sum(amount) FILTER (WHERE stripe_fees_cents IS NOT NULL), 0)::float8 AS fee_base
      FROM donations
      WHERE ${inCenters} AND ${inYear}`),
    prisma.$queryRaw<{ source: string; gifts: number; gross: number }[]>(Prisma.sql`
      SELECT source::text AS source, count(*)::int AS gifts, coalesce(sum(amount), 0)::float8 AS gross
      FROM donations
      WHERE ${inCenters} AND ${inYear}
      GROUP BY 1`),
    prisma.$queryRaw<{ donors: number; monthly: number }[]>(Prisma.sql`
      SELECT count(DISTINCT person_id)::int AS donors, coalesce(sum(amount), 0)::float8 AS monthly
      FROM (
        SELECT DISTINCT ON (stripe_subscription_id) person_id, amount
        FROM donations
        WHERE ${inCenters} AND stripe_subscription_id IS NOT NULL
          AND date >= ${new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)}
        ORDER BY stripe_subscription_id, date DESC
      ) latest`),
  ]);

  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  const months = labels.map((month): MonthRow => {
    const m = byMonth.get(month);
    return m ? { ...m, net: cents(m.gross - m.fees) } : { month, ...empty };
  });
  const totals = months.reduce(
    (t, m) => ({
      gifts: t.gifts + m.gifts,
      donors: 0,
      gross: cents(t.gross + m.gross),
      online: cents(t.online + m.online),
      recurring: cents(t.recurring + m.recurring),
      fees: cents(t.fees + m.fees),
      net: cents(t.net + m.net),
    }),
    { ...empty },
  );
  const s = summary[0];
  totals.donors = s?.donors ?? 0;

  const label = { STRIPE: "Online", IMPORTED: "Bloomerang", MANUAL: "Entered by staff" } as const;
  return {
    year,
    months,
    totals,
    donors: s?.donors ?? 0,
    coveredFeeGifts: s?.covered ?? 0,
    onlineGifts: s?.online_gifts ?? 0,
    feePendingGifts: s?.fee_pending ?? 0,
    effectiveFeeRate: s && s.fee_base > 0 ? totals.fees / s.fee_base : null,
    sources: sources
      .map((r) => ({ source: label[r.source as keyof typeof label], gifts: r.gifts, gross: r.gross }))
      .sort((a, b) => b.gross - a.gross),
    recurringNow: recurring[0] ?? { donors: 0, monthly: 0 },
  };
}
