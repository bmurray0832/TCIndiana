import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { prisma } from "@/lib/prisma";
import { getActiveCenterIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WINDOW_DAYS_OPTIONS = [30, 60, 90, 180, 365] as const;

export default async function FunnelReportPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const windowDays = Number(sp.window) || 90;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const centerIds = await getActiveCenterIds();
  const where = { centerId: { in: centerIds } };

  // Current snapshot of prospects by interest level, plus donors.
  const [cold, warm, hot, donors] = await Promise.all([
    prisma.person.count({ where: { ...where, convertedToDonorAt: null, interestLevel: "COLD" } }),
    prisma.person.count({ where: { ...where, convertedToDonorAt: null, interestLevel: "WARM" } }),
    prisma.person.count({ where: { ...where, convertedToDonorAt: null, interestLevel: "HOT" } }),
    prisma.person.count({ where: { ...where, convertedToDonorAt: { not: null } } }),
  ]);

  // Conversions in the chosen window: prospects who became donors.
  const recentConversions = await prisma.person.count({
    where: { ...where, convertedToDonorAt: { gte: since } },
  });

  // New leads added in the window (still prospects).
  const newProspects = await prisma.person.count({
    where: { ...where, convertedToDonorAt: null, dateAdded: { gte: since } },
  });

  const totalProspects = cold + warm + hot;
  const conversionRate = totalProspects + recentConversions > 0
    ? Math.round((recentConversions / (totalProspects + recentConversions)) * 100)
    : 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Pipeline Funnel"
        subtitle={`Snapshot of where prospects sit today + conversions in the last ${windowDays} days`}
        actions={
          <form action="" className="flex items-center gap-2">
            <label htmlFor="window" className="text-xs text-muted-foreground">Window</label>
            <select
              id="window"
              name="window"
              defaultValue={windowDays}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {WINDOW_DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
              Go
            </button>
          </form>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <FunnelStage label="Cold" count={cold} colorClass="bg-blue-500/15 text-blue-700 dark:text-blue-300" />
        <FunnelStage label="Warm" count={warm} colorClass="bg-orange-500/15 text-orange-700 dark:text-orange-300" />
        <FunnelStage label="Hot" count={hot} colorClass="bg-red-500/15 text-red-700 dark:text-red-300" />
        <FunnelStage label="Donors" count={donors} colorClass="bg-green-500/15 text-green-700 dark:text-green-300" emphasize />
        <FunnelStage label={`Converted in ${windowDays}d`} count={recentConversions} colorClass="bg-primary/15 text-primary" emphasize />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiCard label="Total prospects today" value={totalProspects} />
        <KpiCard label={`New prospects in ${windowDays}d`} value={newProspects} />
        <KpiCard
          label="Conversion rate"
          value={`${conversionRate}%`}
          hint={`Converted / (still-prospects + converted) in ${windowDays}d`}
          tone={conversionRate >= 20 ? "good" : conversionRate >= 10 ? "warning" : "default"}
        />
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Snapshot view: counts reflect the current interest level on each prospect, not historical
        movement. Movement-tracking (stage changes over time) is on the Phase 2 list.
      </p>
    </div>
  );
}

function FunnelStage({
  label,
  count,
  colorClass,
  emphasize,
}: {
  label: string;
  count: number;
  colorClass: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-2xl font-bold tabular-nums ${colorClass}`}>
          {count}
        </span>
      </div>
      {emphasize && <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Outcome</div>}
    </div>
  );
}
