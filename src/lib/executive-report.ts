/** Executive report data — Month, Quarter, Year side-by-side for the
 *  donations, contacts, and donor-pipeline cohorts. Built so directors
 *  can scan one page and know: are we ahead, what changed, what needs
 *  attention. */

import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, getCurrentUser } from "@/lib/auth";

export type PeriodKey = "month" | "quarter" | "year";

export type PeriodRange = { start: Date; end: Date; label: string; key: PeriodKey };

export function periodRanges(now = new Date()): Record<PeriodKey, PeriodRange> {
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  return {
    month: {
      key: "month",
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 1),
      label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    },
    quarter: {
      key: "quarter",
      start: new Date(y, q * 3, 1),
      end: new Date(y, q * 3 + 3, 1),
      label: `Q${q + 1} ${y}`,
    },
    year: {
      key: "year",
      start: new Date(y, 0, 1),
      end: new Date(y + 1, 0, 1),
      label: String(y),
    },
  };
}

function priorRange(range: PeriodRange): PeriodRange {
  if (range.key === "month") {
    const start = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
    const end = range.start;
    return { ...range, start, end, label: "prior month" };
  }
  if (range.key === "quarter") {
    const start = new Date(range.start.getFullYear(), range.start.getMonth() - 3, 1);
    const end = range.start;
    return { ...range, start, end, label: "prior quarter" };
  }
  const start = new Date(range.start.getFullYear() - 1, 0, 1);
  const end = new Date(range.start.getFullYear(), 0, 1);
  return { ...range, start, end, label: "last year" };
}

/** Same-period-last-year for apples-to-apples comparisons. */
function sameRangeLastYear(range: PeriodRange): PeriodRange {
  const start = new Date(range.start.getFullYear() - 1, range.start.getMonth(), range.start.getDate());
  const end = new Date(range.end.getFullYear() - 1, range.end.getMonth(), range.end.getDate());
  return { ...range, start, end, label: `${range.label.replace(String(range.start.getFullYear()), String(range.start.getFullYear() - 1))} (last year)` };
}

export type PeriodStats = {
  range: PeriodRange;
  total: number;
  count: number;
  avg: number;
  largest: { amount: number; donor: string } | null;
  uniqueDonors: number;
  newDonors: number;
  contacts: number;
  topCampaigns: { name: string; raised: number; count: number }[];
  vsPrior: { total: number; pct: number | null };
  vsLastYear: { total: number; pct: number | null };
};

async function statsFor(centerIds: string[], range: PeriodRange): Promise<PeriodStats> {
  const where = { centerId: { in: centerIds }, date: { gte: range.start, lt: range.end } };

  const [agg, distinctDonors, largest, contactsCount, donations] = await Promise.all([
    prisma.donation.aggregate({ where, _sum: { amount: true }, _avg: { amount: true }, _count: true }),
    prisma.donation.findMany({ where, distinct: ["personId"], select: { personId: true } }),
    prisma.donation.findFirst({
      where,
      orderBy: { amount: "desc" },
      include: { person: { select: { firstName: true, lastName: true } } },
    }),
    prisma.contact.count({ where }),
    prisma.donation.findMany({
      where,
      include: { campaign: { select: { name: true } } },
    }),
  ]);

  // First-time donors in this period: people whose earliest donation
  // ever falls in this range.
  const uniquePersonIds = distinctDonors.map((d) => d.personId);
  const personFirstGifts = uniquePersonIds.length
    ? await prisma.donation.groupBy({
        by: ["personId"],
        where: { personId: { in: uniquePersonIds } },
        _min: { date: true },
      })
    : [];
  const newDonors = personFirstGifts.filter(
    (p) => p._min.date && p._min.date >= range.start && p._min.date < range.end,
  ).length;

  // Campaign rollup
  const campaignMap = new Map<string, { raised: number; count: number }>();
  for (const d of donations) {
    const name = d.campaign?.name ?? "Unrestricted";
    const entry = campaignMap.get(name) ?? { raised: 0, count: 0 };
    entry.raised += Number(d.amount);
    entry.count += 1;
    campaignMap.set(name, entry);
  }
  const topCampaigns = [...campaignMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.raised - a.raised)
    .slice(0, 5);

  // Prior period totals for delta
  const prior = priorRange(range);
  const lastYr = sameRangeLastYear(range);
  const [priorAgg, lastYearAgg] = await Promise.all([
    prisma.donation.aggregate({
      where: { centerId: { in: centerIds }, date: { gte: prior.start, lt: prior.end } },
      _sum: { amount: true },
    }),
    prisma.donation.aggregate({
      where: { centerId: { in: centerIds }, date: { gte: lastYr.start, lt: lastYr.end } },
      _sum: { amount: true },
    }),
  ]);
  const total = Number(agg._sum.amount ?? 0);
  const priorTotal = Number(priorAgg._sum.amount ?? 0);
  const lastYrTotal = Number(lastYearAgg._sum.amount ?? 0);

  return {
    range,
    total,
    count: agg._count,
    avg: Math.round(Number(agg._avg.amount ?? 0)),
    largest: largest
      ? { amount: Number(largest.amount), donor: `${largest.person.firstName} ${largest.person.lastName}` }
      : null,
    uniqueDonors: distinctDonors.length,
    newDonors,
    contacts: contactsCount,
    topCampaigns,
    vsPrior: { total: priorTotal, pct: priorTotal > 0 ? Math.round(((total - priorTotal) / priorTotal) * 100) : null },
    vsLastYear: { total: lastYrTotal, pct: lastYrTotal > 0 ? Math.round(((total - lastYrTotal) / lastYrTotal) * 100) : null },
  };
}

export type ExecutiveReport = {
  user: { name: string };
  centers: { id: string; name: string }[];
  generatedAt: Date;
  month: PeriodStats;
  quarter: PeriodStats;
  year: PeriodStats;
  highlights: {
    biggestSupporters: { id: string; name: string; lifetime: number; lastDonationAt: Date | null }[];
    needingAttention: { id: string; name: string; lifetime: number; daysSinceContact: number | null; alert: string; isDonor: boolean }[];
    recentConversions: { id: string; name: string; date: Date }[];
  };
};

export async function executiveReport(): Promise<ExecutiveReport | null> {
  const me = await getCurrentUser();
  const centerIds = await getAccessibleCenterIds();
  if (!me || centerIds.length === 0) return null;

  const ranges = periodRanges();
  const [month, quarter, year] = await Promise.all([
    statsFor(centerIds, ranges.month),
    statsFor(centerIds, ranges.quarter),
    statsFor(centerIds, ranges.year),
  ]);

  // Top 5 supporters by lifetime giving
  const biggestSupportersRaw = await prisma.person.findMany({
    where: { centerId: { in: centerIds }, convertedToDonorAt: { not: null } },
    orderBy: { lifetimeAmount: "desc" },
    take: 5,
    select: { id: true, firstName: true, lastName: true, lifetimeAmount: true, lastDonationAt: true },
  });

  // Needing attention — top 5 by lifetime giving among non-green alerts
  // (we compute this with the same helper the dashboard uses)
  const { listPeople } = await import("@/lib/queries");
  const all = await listPeople({ kind: "all" });
  const needingAttention = all
    .filter((p) => p.alertColor === "RED" || p.alertColor === "ORANGE")
    .sort((a, b) => Number(b.lifetimeAmount) - Number(a.lifetimeAmount))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      lifetime: Number(p.lifetimeAmount),
      daysSinceContact: p.daysSinceContact,
      alert: p.alertColor,
      isDonor: !!p.convertedToDonorAt,
    }));

  // Recent prospect→donor conversions inside the reporting year
  const recentConversionsRaw = await prisma.person.findMany({
    where: {
      centerId: { in: centerIds },
      convertedToDonorAt: { gte: ranges.year.start, lt: ranges.year.end },
    },
    orderBy: { convertedToDonorAt: "desc" },
    take: 5,
    select: { id: true, firstName: true, lastName: true, convertedToDonorAt: true },
  });

  const centers = await prisma.center.findMany({
    where: { id: { in: centerIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return {
    user: { name: me.name },
    centers,
    generatedAt: new Date(),
    month,
    quarter,
    year,
    highlights: {
      biggestSupporters: biggestSupportersRaw.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        lifetime: Number(p.lifetimeAmount),
        lastDonationAt: p.lastDonationAt,
      })),
      needingAttention,
      recentConversions: recentConversionsRaw.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        date: p.convertedToDonorAt!,
      })),
    },
  };
}
