import { NextResponse } from "next/server";
import { runBloomerangSyncAll } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Run this job on demand. The in-app scheduler (lib/scheduler.ts) runs
 *  it on its timetable; this endpoint is for testing and manual runs.
 *  Add ?full=1 to re-read everything from Bloomerang. */
async function run(request: Request) {
  if (!authOk(request)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await runBloomerangSyncAll({ full: new URL(request.url).searchParams.get("full") === "1" });
  return NextResponse.json({ ...result, ranAt: new Date().toISOString() }, { status: result.ok ? 200 : 502 });
}

export const GET = run;
export const POST = run;
