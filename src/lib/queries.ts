/** Server-side data fetchers used by pages. Each one scopes to the
 *  current user's accessible centers via the auth shim. */

import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, getCurrentUser } from "@/lib/auth";
import {
  computeAlertColor,
  daysSinceContact,
  effectiveThresholds,
  type AlertThresholds,
} from "@/lib/alerts";
import { Prisma, type AlertColor, type Person } from "@/generated/prisma";

const recentDonationArgs = Prisma.validator<Prisma.DonationDefaultArgs>()({
  include: {
    person: { select: { id: true, firstName: true, lastName: true } },
    campaign: { select: { name: true } },
  },
});
export type RecentDonation = Prisma.DonationGetPayload<typeof recentDonationArgs>;

export type PersonWithAlert = Person & {
  center: { id: string; name: string };
  daysSinceContact: number | null;
  alertColor: AlertColor;
};

async function thresholdsForCenter(centerId: string): Promise<AlertThresholds> {
  const center = await prisma.center.findUnique({
    where: { id: centerId },
    select: { alertThresholds: true, organization: { select: { defaultAlertThresholds: true } } },
  });
  return effectiveThresholds(
    center?.organization.defaultAlertThresholds,
    center?.alertThresholds,
  );
}

function decorate(p: Person & { center: { id: string; name: string } }, thresholds: AlertThresholds): PersonWithAlert {
  const days = daysSinceContact(p.lastContactAt);
  const isDonor = p.convertedToDonorAt !== null;
  return {
    ...p,
    daysSinceContact: days,
    alertColor: computeAlertColor(days, isDonor, thresholds, p.snoozedUntil),
  };
}

export async function listPeople(opts: { kind: "donor" | "prospect" | "all" }): Promise<PersonWithAlert[]> {
  const centerIds = await getAccessibleCenterIds();
  if (centerIds.length === 0) return [];

  const where: { centerId: { in: string[] }; convertedToDonorAt?: { not: null } | null } = {
    centerId: { in: centerIds },
  };
  if (opts.kind === "donor") where.convertedToDonorAt = { not: null };
  if (opts.kind === "prospect") where.convertedToDonorAt = null;

  const people = await prisma.person.findMany({
    where,
    include: { center: { select: { id: true, name: true } } },
    orderBy: [{ lastContactAt: "asc" }, { lastName: "asc" }],
  });

  // Cache thresholds per center
  const tCache = new Map<string, AlertThresholds>();
  const results: PersonWithAlert[] = [];
  for (const p of people) {
    let t = tCache.get(p.centerId);
    if (!t) {
      t = await thresholdsForCenter(p.centerId);
      tCache.set(p.centerId, t);
    }
    results.push(decorate(p, t));
  }
  return results;
}

export async function getPerson(id: string) {
  const centerIds = await getAccessibleCenterIds();
  const p = await prisma.person.findFirst({
    where: { id, centerId: { in: centerIds } },
    include: {
      center: { select: { id: true, name: true } },
      contacts: {
        orderBy: { date: "desc" },
        include: { staff: { select: { id: true, name: true } } },
      },
      donations: {
        orderBy: { date: "desc" },
        include: { campaign: { select: { id: true, name: true } } },
      },
    },
  });
  if (!p) return null;
  const t = await thresholdsForCenter(p.centerId);
  const days = daysSinceContact(p.lastContactAt);
  const isDonor = p.convertedToDonorAt !== null;
  return {
    ...p,
    daysSinceContact: days,
    alertColor: computeAlertColor(days, isDonor, t, p.snoozedUntil),
  };
}

export async function dashboardMetrics() {
  const centerIds = await getAccessibleCenterIds();
  if (centerIds.length === 0) {
    return {
      donors: 0,
      prospects: 0,
      ytd: 0,
      avgGift: 0,
      contactsThisMonth: 0,
      redDonors: 0,
      redProspects: 0,
      needingAttention: [] as PersonWithAlert[],
      recentDonations: [] as RecentDonation[],
    };
  }

  const where = { centerId: { in: centerIds } };
  const donorsCount = await prisma.person.count({
    where: { ...where, convertedToDonorAt: { not: null } },
  });
  const prospectsCount = await prisma.person.count({
    where: { ...where, convertedToDonorAt: null },
  });

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const ytdAgg = await prisma.donation.aggregate({
    where: { ...where, date: { gte: yearStart } },
    _sum: { amount: true },
    _avg: { amount: true },
  });

  const contactsThisMonth = await prisma.contact.count({
    where: { ...where, date: { gte: monthStart } },
  });

  const people = await listPeople({ kind: "all" });
  const redDonors = people.filter((p) => p.convertedToDonorAt && p.alertColor === "RED").length;
  const redProspects = people.filter((p) => !p.convertedToDonorAt && p.alertColor === "RED").length;
  const needingAttention = people
    .filter((p) => p.alertColor === "RED" || p.alertColor === "ORANGE")
    .sort((a, b) => Number(b.lifetimeAmount) - Number(a.lifetimeAmount))
    .slice(0, 10);

  const recentDonations = await prisma.donation.findMany({
    where,
    orderBy: { date: "desc" },
    take: 8,
    ...recentDonationArgs,
  });

  return {
    donors: donorsCount,
    prospects: prospectsCount,
    ytd: Number(ytdAgg._sum.amount ?? 0),
    avgGift: Math.round(Number(ytdAgg._avg.amount ?? 0)),
    contactsThisMonth,
    redDonors,
    redProspects,
    needingAttention,
    recentDonations,
  };
}

/** Leadership view: YoY, monthly trend, campaign progress, pipeline,
 *  and per-center performance. Lives separately so the original
 *  dashboardMetrics() stays focused. */
export async function leadershipMetrics() {
  const centerIds = await getAccessibleCenterIds();
  const me = await getCurrentUser();
  if (centerIds.length === 0 || !me) {
    return null;
  }

  const now = new Date();
  const thisYear = now.getFullYear();
  const yearStart = new Date(thisYear, 0, 1);
  const lastYearStart = new Date(thisYear - 1, 0, 1);
  const sameDayLastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const monthStart = new Date(thisYear, now.getMonth(), 1);
  const lastMonthStart = new Date(thisYear, now.getMonth() - 1, 1);

  const where = { centerId: { in: centerIds } };

  // YTD vs same period last year (apples-to-apples through today's date).
  const [ytdAgg, ytdLastYearAgg, lastFullYearAgg, monthAgg, lastMonthAgg] = await Promise.all([
    prisma.donation.aggregate({
      where: { ...where, date: { gte: yearStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.donation.aggregate({
      where: { ...where, date: { gte: lastYearStart, lte: sameDayLastYear } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.donation.aggregate({
      where: { ...where, date: { gte: lastYearStart, lt: yearStart } },
      _sum: { amount: true },
    }),
    prisma.donation.aggregate({
      where: { ...where, date: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.donation.aggregate({
      where: { ...where, date: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amount: true },
    }),
  ]);

  const ytd = Number(ytdAgg._sum.amount ?? 0);
  const ytdLastYear = Number(ytdLastYearAgg._sum.amount ?? 0);
  const lastFullYear = Number(lastFullYearAgg._sum.amount ?? 0);
  const monthTotal = Number(monthAgg._sum.amount ?? 0);
  const lastMonthTotal = Number(lastMonthAgg._sum.amount ?? 0);

  // 12-month bar chart data — group donations by month.
  const twelveMonthsAgo = new Date(thisYear, now.getMonth() - 11, 1);
  const allRecent = await prisma.donation.findMany({
    where: { ...where, date: { gte: twelveMonthsAgo } },
    select: { date: true, amount: true },
  });
  const buckets: { label: string; total: number; month: number; year: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(thisYear, now.getMonth() - i, 1);
    buckets.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      total: 0,
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  for (const d of allRecent) {
    const m = d.date.getMonth();
    const y = d.date.getFullYear();
    const bucket = buckets.find((b) => b.month === m && b.year === y);
    if (bucket) bucket.total += Number(d.amount);
  }

  // Campaign progress — top 6 by raised this year.
  const campaigns = await prisma.campaign.findMany({
    where: {
      organizationId: me.organizationId,
      active: true,
      OR: [{ centerId: null }, { centerId: { in: centerIds } }],
    },
  });
  const campaignProgress = await Promise.all(
    campaigns.map(async (c) => {
      const agg = await prisma.donation.aggregate({
        where: { ...where, campaignId: c.id, date: { gte: yearStart } },
        _sum: { amount: true },
        _count: true,
      });
      return {
        id: c.id,
        name: c.name,
        goal: c.goalAmount ? Number(c.goalAmount) : null,
        raised: Number(agg._sum.amount ?? 0),
        count: agg._count,
      };
    }),
  );
  campaignProgress.sort((a, b) => b.raised - a.raised);

  // Pipeline + new donors + retention. Reuse the in-memory people list
  // (already filtered by accessible centers).
  const people = await listPeople({ kind: "all" });
  const cold = people.filter((p) => !p.convertedToDonorAt && p.interestLevel === "COLD").length;
  const warm = people.filter((p) => !p.convertedToDonorAt && p.interestLevel === "WARM").length;
  const hot = people.filter((p) => !p.convertedToDonorAt && p.interestLevel === "HOT").length;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentConversions = people.filter(
    (p) => p.convertedToDonorAt && new Date(p.convertedToDonorAt) >= ninetyDaysAgo,
  ).length;
  const newDonorsThisMonth = people.filter(
    (p) => p.convertedToDonorAt && new Date(p.convertedToDonorAt) >= monthStart,
  ).length;

  // Retention: donors who gave last year and have also given this year.
  const lastYearDonorIds = await prisma.donation.findMany({
    where: { ...where, date: { gte: lastYearStart, lt: yearStart } },
    distinct: ["personId"],
    select: { personId: true },
  });
  const thisYearDonorIdSet = new Set(
    (
      await prisma.donation.findMany({
        where: { ...where, date: { gte: yearStart } },
        distinct: ["personId"],
        select: { personId: true },
      })
    ).map((r) => r.personId),
  );
  const cohortSize = lastYearDonorIds.length;
  const retainedCount = lastYearDonorIds.filter((r) => thisYearDonorIdSet.has(r.personId)).length;
  const retentionRate = cohortSize > 0 ? Math.round((retainedCount / cohortSize) * 100) : 0;

  // Per-center YTD breakdown.
  const accessibleCenters = await prisma.center.findMany({
    where: { id: { in: centerIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const centerBreakdown = await Promise.all(
    accessibleCenters.map(async (c) => {
      const [thisYearAgg, lastYearAgg] = await Promise.all([
        prisma.donation.aggregate({
          where: { centerId: c.id, date: { gte: yearStart } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.donation.aggregate({
          where: { centerId: c.id, date: { gte: lastYearStart, lte: sameDayLastYear } },
          _sum: { amount: true },
        }),
      ]);
      const t = Number(thisYearAgg._sum.amount ?? 0);
      const ly = Number(lastYearAgg._sum.amount ?? 0);
      return {
        id: c.id,
        name: c.name,
        ytd: t,
        ytdLastYear: ly,
        change: ly > 0 ? Math.round(((t - ly) / ly) * 100) : null,
        count: thisYearAgg._count,
      };
    }),
  );

  return {
    ytd,
    ytdLastYear,
    ytdChange: ytdLastYear > 0 ? Math.round(((ytd - ytdLastYear) / ytdLastYear) * 100) : null,
    lastFullYear,
    monthTotal,
    lastMonthTotal,
    monthChange: lastMonthTotal > 0 ? Math.round(((monthTotal - lastMonthTotal) / lastMonthTotal) * 100) : null,
    monthlyTrend: buckets,
    campaignProgress: campaignProgress.slice(0, 6),
    pipeline: { cold, warm, hot, recentConversions },
    newDonorsThisMonth,
    retentionRate,
    cohortSize,
    retainedCount,
    centerBreakdown,
    centerCount: accessibleCenters.length,
  };
}

export async function currentUserSummary() {
  const me = await getCurrentUser();
  const centerIds = await getAccessibleCenterIds();
  const centers = centerIds.length
    ? await prisma.center.findMany({
        where: { id: { in: centerIds } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  return { user: me, centers };
}
