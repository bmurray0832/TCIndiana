/** The scheduled jobs themselves, independent of what triggers them.
 *  The in-app scheduler (lib/scheduler.ts) runs them on a timetable;
 *  the /api/cron/* routes run the same functions on demand. */

import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/stripe";
import {
  buildLapsedDonorDigest,
  buildWeeklyDigest,
  renderLapsedDigestText,
  renderWeeklyDigestText,
  sendDigestEmail,
} from "@/lib/digest";
import { isBloomerangConfigured } from "@/lib/bloomerang/client";
import { runBloomerangSync } from "@/lib/bloomerang/sync";

export type JobResult = { ok: boolean; [key: string]: unknown };

/** Each active user gets their own list of who to follow up with. */
export async function runWeeklyDigest(): Promise<JobResult> {
  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } });
  const base = appOrigin();
  let sent = 0;
  let skipped = 0;
  const skipReasons: string[] = [];

  for (const u of users) {
    const digest = await buildWeeklyDigest(u.id);
    if (!digest || digest.rows.length === 0) {
      skipped++;
      continue;
    }
    const result = await sendDigestEmail({
      to: digest.user.email,
      subject: `${digest.rows.length} ${digest.rows.length === 1 ? "person" : "people"} to follow up with this week`,
      body: renderWeeklyDigestText(digest, base),
    });
    if (result.sent) sent++;
    else {
      skipped++;
      if (result.reason && !skipReasons.includes(result.reason)) skipReasons.push(result.reason);
    }
  }
  return { ok: true, sent, skipped, skipReasons };
}

/** Org admins get the month's re-engagement list. */
export async function runLapsedDonors(): Promise<JobResult> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const base = appOrigin();
  let sent = 0;
  let skipped = 0;

  for (const org of orgs) {
    const digest = await buildLapsedDonorDigest(org.id);
    if (!digest || digest.lapsed.length === 0) {
      skipped += digest?.admins.length ?? 0;
      continue;
    }
    for (const admin of digest.admins) {
      const result = await sendDigestEmail({
        to: admin.email,
        subject: `Monthly re-engagement list — ${digest.lapsed.length} lapsed donors`,
        body: renderLapsedDigestText(digest, admin.name, base),
      });
      if (result.sent) sent++;
      else skipped++;
    }
  }
  return { ok: true, sent, skipped };
}

/** Incremental pull from Bloomerang for every organization that has
 *  picked a landing center. A no-op until the API key is configured. */
export async function runBloomerangSyncAll(opts: { full?: boolean } = {}): Promise<JobResult> {
  if (!isBloomerangConfigured()) return { ok: true, skipped: "BLOOMERANG_API_KEY is not set" };
  const orgs = await prisma.organization.findMany({
    where: { bloomerangDefaultCenterId: { not: null } },
    select: { id: true, slug: true },
  });
  const results = [];
  for (const org of orgs) {
    results.push({ org: org.slug, ...(await runBloomerangSync({ organizationId: org.id, full: opts.full })) });
  }
  return { ok: results.every((r) => r.ok), results };
}
