import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBloomerangConfigured } from "@/lib/bloomerang/client";
import { runBloomerangSync } from "@/lib/bloomerang/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Nightly incremental pull from Bloomerang for every organization that
 *  has picked a landing center. Add ?full=1 to re-read everything. */
async function run(request: Request) {
  if (!authOk(request)) return new NextResponse("Unauthorized", { status: 401 });
  if (!isBloomerangConfigured()) {
    return NextResponse.json({ ok: false, error: "BLOOMERANG_API_KEY is not set." }, { status: 503 });
  }
  const full = new URL(request.url).searchParams.get("full") === "1";
  const orgs = await prisma.organization.findMany({
    where: { bloomerangDefaultCenterId: { not: null } },
    select: { id: true, slug: true },
  });
  const results = [];
  for (const org of orgs) {
    results.push({ org: org.slug, ...(await runBloomerangSync({ organizationId: org.id, full })) });
  }
  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
}

export const GET = run;
export const POST = run;
