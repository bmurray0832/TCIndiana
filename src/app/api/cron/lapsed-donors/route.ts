import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appOrigin } from "@/lib/stripe";
import { buildLapsedDonorDigest, renderLapsedDigestText, sendDigestEmail } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authOk(request)) return new NextResponse("Unauthorized", { status: 401 });
  return run();
}
export async function GET(request: Request) {
  if (!authOk(request)) return new NextResponse("Unauthorized", { status: 401 });
  return run();
}

async function run() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
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
      const body = renderLapsedDigestText(digest, admin.name, base);
      const result = await sendDigestEmail({
        to: admin.email,
        subject: `Monthly re-engagement list — ${digest.lapsed.length} lapsed donors`,
        body,
      });
      if (result.sent) sent++;
      else skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, ranAt: new Date().toISOString() });
}
