/** Email digest generator for scheduled cron jobs. Each digest is built
 *  server-side from the same alert engine the dashboard uses.
 */

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { computeAlertColor, daysSinceContact, effectiveThresholds, type AlertThresholds } from "@/lib/alerts";
import { formatCurrency, formatDate } from "@/lib/utils";

type AlertColor = "GREEN" | "YELLOW" | "ORANGE" | "RED";

type DigestRow = {
  id: string;
  firstName: string;
  lastName: string;
  isDonor: boolean;
  lifetime: number;
  daysSince: number | null;
  alert: AlertColor;
  centerName: string;
};

function rankPriority(alert: AlertColor): number {
  return { RED: 3, ORANGE: 2, YELLOW: 1, GREEN: 0 }[alert];
}

async function thresholdsFor(centerId: string, orgDefault: unknown): Promise<AlertThresholds> {
  const c = await prisma.center.findUnique({ where: { id: centerId }, select: { alertThresholds: true } });
  return effectiveThresholds(orgDefault, c?.alertThresholds);
}

/** Build the per-user weekly-digest payload: top 10 needing attention
 *  in their accessible centers, sorted by alert then lifetime giving. */
export async function buildWeeklyDigest(userId: string): Promise<{
  user: { id: string; email: string; name: string };
  centers: { id: string; name: string }[];
  rows: DigestRow[];
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId, active: true },
    include: {
      organization: { select: { defaultAlertThresholds: true } },
      centerRoles: { include: { center: { select: { id: true, name: true } } } },
    },
  });
  if (!user) return null;
  const orgDefault = user.organization.defaultAlertThresholds;
  const centerIds =
    user.orgRole === "ORG_ADMIN"
      ? (await prisma.center.findMany({ where: { organizationId: user.organizationId }, select: { id: true } })).map((c) => c.id)
      : user.centerRoles.map((r) => r.centerId);
  if (centerIds.length === 0) return null;

  const people = await prisma.person.findMany({
    where: { centerId: { in: centerIds } },
    include: { center: { select: { id: true, name: true } } },
  });

  const rows: DigestRow[] = [];
  const tCache = new Map<string, AlertThresholds>();
  for (const p of people) {
    let t = tCache.get(p.centerId);
    if (!t) {
      t = await thresholdsFor(p.centerId, orgDefault);
      tCache.set(p.centerId, t);
    }
    const days = daysSinceContact(p.lastContactAt);
    const isDonor = !!p.convertedToDonorAt;
    const alert = computeAlertColor(days, isDonor, t, p.snoozedUntil);
    if (alert === "GREEN") continue;
    rows.push({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      isDonor,
      lifetime: Number(p.lifetimeAmount),
      daysSince: days,
      alert,
      centerName: p.center.name,
    });
  }
  rows.sort((a, b) => rankPriority(b.alert) - rankPriority(a.alert) || b.lifetime - a.lifetime);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    centers: user.centerRoles.map((r) => ({ id: r.center.id, name: r.center.name })),
    rows: rows.slice(0, 10),
  };
}

function renderRow(r: DigestRow, baseUrl: string): string {
  return [
    `  • ${r.firstName} ${r.lastName}`,
    `    ${r.isDonor ? "Donor" : "Prospect"} — ${r.daysSince === null ? "never contacted" : `${r.daysSince} days out`} — ${r.alert.toLowerCase()}`,
    r.isDonor && r.lifetime > 0 ? `    Lifetime: ${formatCurrency(r.lifetime)}` : null,
    `    ${baseUrl}/people/${r.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderWeeklyDigestText(d: NonNullable<Awaited<ReturnType<typeof buildWeeklyDigest>>>, baseUrl: string): string {
  const rows = d.rows.map((r) => renderRow(r, baseUrl)).join("\n\n");
  return [
    `Hi ${d.user.name.split(" ")[0]},`,
    "",
    `Here are the ${d.rows.length} ${d.rows.length === 1 ? "person" : "people"} who most need a touch this week:`,
    "",
    rows || "  Nobody — every donor and prospect is in the green right now. Nice work.",
    "",
    `Open the full queue: ${baseUrl}/follow-ups`,
    "",
    "— TC Indiana CRM",
  ].join("\n");
}

/** Build the monthly lapsed-donor report for an org. Sent to org admins. */
export async function buildLapsedDonorDigest(orgId: string): Promise<{
  admins: { id: string; email: string; name: string }[];
  lapsed: { id: string; firstName: string; lastName: string; lifetime: number; lastDonationAt: Date | null; centerName: string }[];
} | null> {
  const admins = await prisma.user.findMany({
    where: { organizationId: orgId, orgRole: "ORG_ADMIN", active: true },
  });
  if (admins.length === 0) return null;

  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const lapsed = await prisma.person.findMany({
    where: {
      center: { organizationId: orgId },
      convertedToDonorAt: { not: null },
      OR: [{ lastDonationAt: { lt: yearAgo } }, { donorStatus: "LAPSED" }],
    },
    include: { center: { select: { name: true } } },
    orderBy: { lifetimeAmount: "desc" },
    take: 25,
  });

  return {
    admins: admins.map((a) => ({ id: a.id, email: a.email, name: a.name })),
    lapsed: lapsed.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      lifetime: Number(p.lifetimeAmount),
      lastDonationAt: p.lastDonationAt,
      centerName: p.center.name,
    })),
  };
}

export function renderLapsedDigestText(
  d: NonNullable<Awaited<ReturnType<typeof buildLapsedDonorDigest>>>,
  adminName: string,
  baseUrl: string,
): string {
  const rows = d.lapsed
    .map((p) =>
      [
        `  • ${p.firstName} ${p.lastName} — ${p.centerName}`,
        `    Last gift: ${formatDate(p.lastDonationAt)} · lifetime ${formatCurrency(p.lifetime)}`,
        `    ${baseUrl}/people/${p.id}`,
      ].join("\n"),
    )
    .join("\n\n");
  return [
    `Hi ${adminName.split(" ")[0]},`,
    "",
    `Your top ${d.lapsed.length} lapsed donors (no gift in 12+ months or status=Lapsed), ranked by lifetime giving:`,
    "",
    rows || "  No lapsed donors right now. Nice retention.",
    "",
    `Re-engagement report: ${baseUrl}/reports/retention`,
    "",
    "— TC Indiana CRM",
  ].join("\n");
}

/** Send via Resend if configured; otherwise log to the console and
 *  return a "skipped" marker so the cron route reports honestly. */
export async function sendDigestEmail(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;
  if (!key || !from) {
    console.log(`[digest] Resend not configured — would send to ${args.to}: ${args.subject}`);
    return { sent: false, reason: "resend-not-configured" };
  }
  const resend = new Resend(key);
  const res = await resend.emails.send({ from, to: args.to, subject: args.subject, text: args.body });
  if (res.error) return { sent: false, reason: res.error.message };
  return { sent: true };
}
