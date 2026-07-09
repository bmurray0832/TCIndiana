import { PageHeader } from "@/components/PageHeader";
import { BiggestSupportersTable } from "@/components/tables/BiggestSupportersTable";
import { ReportActions } from "@/components/reports/ReportActions";
import { listPeople, currentUserSummary } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BiggestSupportersPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const sp = await searchParams;
  const n = Math.max(5, Math.min(200, Number(sp.n) || 50));

  const [donors, me] = await Promise.all([listPeople({ kind: "donor" }), currentUserSummary()]);
  const top = donors
    .slice()
    .sort((a, b) => Number(b.lifetimeAmount) - Number(a.lifetimeAmount))
    .slice(0, n);

  const totalShown = top.reduce((s, p) => s + Number(p.lifetimeAmount), 0);
  const totalAll = donors.reduce((s, p) => s + Number(p.lifetimeAmount), 0);
  const sharePct = totalAll > 0 ? Math.round((totalShown / totalAll) * 100) : 0;

  const csvRows = top.map((p, i) => ({
    rank: i + 1,
    firstName: p.firstName,
    lastName: p.lastName,
    lifetime: Number(p.lifetimeAmount),
    thisYear: Number(p.ytdAmount),
    lastYear: Number(p.lastYearAmount),
    lastContact: p.lastContactAt ? new Date(p.lastContactAt).toISOString().slice(0, 10) : null,
    alert: p.alertColor,
  }));

  return (
    <div className="p-6">
      <PageHeader
        title="Biggest Supporters"
        subtitle={`Top ${top.length} donors · ${formatCurrency(totalShown)} (${sharePct}% of all lifetime giving)`}
        actions={
          <>
          <ReportActions rows={csvRows} filename={`biggest-supporters-top-${top.length}`} />
          <form action="" className="flex items-center gap-2">
            <label htmlFor="n" className="text-xs text-muted-foreground">Show top</label>
            <input
              id="n"
              name="n"
              type="number"
              min={5}
              max={200}
              defaultValue={n}
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <button type="submit" className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
              Go
            </button>
          </form>
          </>
        }
      />

      <BiggestSupportersTable top={top} centerNames={me.centers.map((c) => c.name)} />
    </div>
  );
}
