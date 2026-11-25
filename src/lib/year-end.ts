/** Year-end numbers: giving for the whole state and for each center,
 *  and each donor's gifts for their giving statement.
 *
 *  A year is the calendar year of the gift date as stored (gift dates
 *  are date-only for imported and hand-entered gifts, so no time-zone
 *  shift is applied). Refunded gifts are already removed or reduced
 *  when the refund is recorded, so totals here are what was kept.
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type SummaryRow = { gifts: number; donors: number; total: number };
export type CenterSummary = SummaryRow & { centerId: string; name: string };

const yearRange = (year: number) => ({
  gte: new Date(Date.UTC(year, 0, 1)),
  lt: new Date(Date.UTC(year + 1, 0, 1)),
});

/** One row per center plus the combined total. Donors are counted once
 *  in the total even if they gave at more than one center. */
export async function yearEndSummary(
  centerIds: string[],
  year: number,
): Promise<{ total: SummaryRow; centers: CenterSummary[] }> {
  if (centerIds.length === 0) return { total: { gifts: 0, donors: 0, total: 0 }, centers: [] };
  const { gte, lt } = yearRange(year);
  const where = Prisma.sql`center_id IN (${Prisma.join(centerIds)}) AND date >= ${gte} AND date < ${lt}`;

  const [centers, perCenter, overall] = await Promise.all([
    prisma.center.findMany({ where: { id: { in: centerIds } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.$queryRaw<{ center_id: string; gifts: number; donors: number; total: number }[]>(Prisma.sql`
      SELECT center_id, count(*)::int AS gifts, count(DISTINCT person_id)::int AS donors,
             coalesce(sum(amount), 0)::float8 AS total
      FROM donations WHERE ${where} GROUP BY center_id`),
    prisma.$queryRaw<{ gifts: number; donors: number; total: number }[]>(Prisma.sql`
      SELECT count(*)::int AS gifts, count(DISTINCT person_id)::int AS donors,
             coalesce(sum(amount), 0)::float8 AS total
      FROM donations WHERE ${where}`),
  ]);

  const byCenter = new Map(perCenter.map((r) => [r.center_id, r]));
  return {
    total: overall[0] ?? { gifts: 0, donors: 0, total: 0 },
    centers: centers.map((c) => {
      const r = byCenter.get(c.id);
      return { centerId: c.id, name: c.name, gifts: r?.gifts ?? 0, donors: r?.donors ?? 0, total: r?.total ?? 0 };
    }),
  };
}

export type StatementGift = { date: Date; amount: number; campaign: string | null; method: string };

export type Statement = {
  personId: string;
  name: string;
  email: string | null;
  centerName: string;
  centerAddress: string | null;
  gifts: StatementGift[];
  total: number;
};

/** Statements for every donor with a gift in the year, or for one
 *  donor. Only gifts in `centerIds` are included, which is also what
 *  keeps a statement to the centers the viewer may see. */
export async function yearEndStatements(
  centerIds: string[],
  year: number,
  personId?: string,
): Promise<Statement[]> {
  if (centerIds.length === 0) return [];
  const gifts = await prisma.donation.findMany({
    where: { centerId: { in: centerIds }, date: yearRange(year), ...(personId ? { personId } : {}) },
    orderBy: { date: "asc" },
    select: {
      date: true,
      amount: true,
      paymentMethod: true,
      campaign: { select: { name: true } },
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          center: { select: { name: true, address: true } },
        },
      },
    },
  });

  const byPerson = new Map<string, Statement>();
  for (const g of gifts) {
    const p = g.person;
    let s = byPerson.get(p.id);
    if (!s) {
      s = {
        personId: p.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
        email: p.email,
        centerName: p.center.name,
        centerAddress: p.center.address,
        gifts: [],
        total: 0,
      };
      byPerson.set(p.id, s);
    }
    const amount = Number(g.amount);
    s.gifts.push({
      date: g.date,
      amount,
      campaign: g.campaign?.name ?? null,
      method: g.paymentMethod.replace(/_/g, " ").toLowerCase(),
    });
    s.total = Math.round((s.total + amount) * 100) / 100;
  }
  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Clamp a ?year= value to something sensible; defaults to this year. */
export function parseYear(raw: string | undefined, now = new Date()): number {
  const thisYear = now.getUTCFullYear();
  const y = Number(raw);
  return Number.isInteger(y) && y >= 2000 && y <= thisYear ? y : thisYear;
}
