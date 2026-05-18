import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/stripe";
import { buildWeeklyDigest, renderWeeklyDigestText, sendDigestEmail } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authOk(request)) return new NextResponse("Unauthorized", { status: 401 });
  return runDigest();
}

// Allow GET for cron services that prefer it. Same auth check.
export async function GET(request: Request) {
  if (!authOk(request)) return new NextResponse("Unauthorized", { status: 401 });
  return runDigest();
}

async function runDigest() {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true },
  });
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
    const body = renderWeeklyDigestText(digest, base);
    const result = await sendDigestEmail({
      to: digest.user.email,
      subject: `${digest.rows.length} ${digest.rows.length === 1 ? "person" : "people"} to follow up with this week`,
      body,
    });
    if (result.sent) sent++;
    else {
      skipped++;
      if (result.reason && !skipReasons.includes(result.reason)) skipReasons.push(result.reason);
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, skipReasons, ranAt: new Date().toISOString() });
}
