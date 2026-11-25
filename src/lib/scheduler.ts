/** In-app scheduler. Railway has no "call this URL on a schedule"
 *  feature, and this app runs as one always-on server, so the server
 *  keeps its own timetable: once a minute it checks which jobs are due
 *  and claims each due run in the database before starting it.
 *
 *  The claim (a unique row per job per day) is what makes this safe
 *  across restarts, deploys and extra replicas — a digest can never be
 *  sent twice. A run missed during an outage starts on the next tick if
 *  still inside the grace window, and is otherwise skipped.
 *
 *  Started from instrumentation.ts in production. Set
 *  SCHEDULER_DISABLED=1 to turn it off (e.g. on a preview deploy).
 */

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { runBloomerangSyncAll, runLapsedDonors, runWeeklyDigest, type JobResult } from "@/lib/jobs";
import { dueSlot, type Schedule } from "@/lib/schedule";

const TIME_ZONE = process.env.SCHEDULER_TZ || "America/Indiana/Indianapolis";

const JOBS: { name: string; schedule: Schedule; run: () => Promise<JobResult> }[] = [
  { name: "weekly-digest", schedule: { weekday: 1, hour: 9, minute: 0 }, run: runWeeklyDigest },
  { name: "lapsed-donors", schedule: { dayOfMonth: 1, hour: 10, minute: 0 }, run: runLapsedDonors },
  { name: "bloomerang-sync", schedule: { hour: 2, minute: 0 }, run: () => runBloomerangSyncAll() },
];

function log(level: "info" | "error", fields: Record<string, unknown>) {
  console[level === "error" ? "error" : "log"](
    JSON.stringify({ level, source: "scheduler", ...fields, at: new Date().toISOString() }),
  );
}

/** Insert the claim row; false if another process already has it. */
async function claim(job: string, slot: string): Promise<string | null> {
  try {
    return (await prisma.scheduledRun.create({ data: { job, slot }, select: { id: true } })).id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
}

export async function tick(now = new Date()) {
  for (const job of JOBS) {
    const slot = dueSlot(job.schedule, now, TIME_ZONE);
    if (!slot) continue;
    try {
      const id = await claim(job.name, slot);
      if (!id) continue;
      log("info", { job: job.name, slot, event: "start" });
      let result: JobResult;
      try {
        result = await job.run();
      } catch (e) {
        result = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      await prisma.scheduledRun.update({
        where: { id },
        data: { finishedAt: new Date(), ok: result.ok, detail: result as Prisma.InputJsonValue },
      });
      log(result.ok ? "info" : "error", { job: job.name, slot, event: "finish", result });
    } catch (e) {
      // Database unreachable etc. Leave the slot unclaimed; the next tick retries.
      log("error", { job: job.name, slot, event: "tick-failed", message: e instanceof Error ? e.message : String(e) });
    }
  }
}

const globalForScheduler = globalThis as unknown as { schedulerStarted?: boolean };

export function startScheduler() {
  if (globalForScheduler.schedulerStarted) return;
  globalForScheduler.schedulerStarted = true;
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return; // a long sync must not overlap the next tick
    busy = true;
    try {
      await tick();
    } finally {
      busy = false;
    }
  }, 60_000);
  timer.unref();
  log("info", { event: "started", timeZone: TIME_ZONE, jobs: JOBS.map((j) => j.name) });
}
