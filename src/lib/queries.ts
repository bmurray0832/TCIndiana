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
