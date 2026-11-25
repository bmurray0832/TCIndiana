import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { ReportActions } from "@/components/reports/ReportActions";
import { getActiveCenterIds } from "@/lib/auth";
import { givingBreakdown } from "@/lib/giving-report";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const whole = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function GivingBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const asked = Number(sp.year);
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= thisYear ? asked : thisYear;

  const r = await givingBreakdown(await getActiveCenterIds(), year);
  const maxGross = Math.max(...r.months.map((m) => m.gross), 1);
  const shown = r.months.filter((m) => year < thisYear || Number(m.month.slice(5)) <= new Date().getMonth() + 1);

  const csvRows = shown.map((m) => ({
    month: m.month,
    gifts: m.gifts,
    donors: m.donors,
    gross: m.gross,
    online: m.online,
    recurring: m.recurring,
    processorFees: m.fees,
    net: m.net,
  }));

  return (
    <div className="p-6">
      <PageHeader
        title="Giving Breakdown"
        subtitle={`${year} · what came in, what it cost to process, and what you kept`}
        actions={
          <div className="flex items-center gap-2">
            <form action="" className="print:hidden">
              <select
                name="year"
                defaultValue={year}
                aria-label="Year"
                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
              >
                {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button type="submit" className="ml-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Show
              </button>
            </form>
            <ReportActions rows={csvRows} filename={`giving-breakdown-${year}`} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total given" value={whole(r.totals.gross)} hint={`${r.totals.gifts} gifts from ${r.donors} donors`} />
        <KpiCard
          label="Processing fees"
          value={money(r.totals.fees)}
          hint={
            r.effectiveFeeRate === null
              ? "No online gifts with a known fee yet"
              : `${(r.effectiveFeeRate * 100).toFixed(1)}% of online giving` +
                (r.feePendingGifts > 0 ? ` · ${r.feePendingGifts} still pending` : "")
          }
        />
        <KpiCard label="Net to the mission" value={whole(r.totals.net)} hint="Total given minus processing fees" tone="good" />
        <KpiCard
          label="Monthly recurring"
          value={whole(r.recurringNow.monthly)}
          hint={`${r.recurringNow.donors} active monthly ${r.recurringNow.donors === 1 ? "donor" : "donors"}`}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold">Where gifts came from</h2>
          {r.sources.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No gifts recorded in {year}.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {r.sources.map((s) => (
                <li key={s.source} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0">{s.source}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.max((s.gross / Math.max(r.totals.gross, 1)) * 100, 1.5)}%` }}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right font-medium tabular-nums">{whole(s.gross)}</span>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{s.gifts} gifts</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Donors covering fees</h2>
          <div className="mt-2 text-2xl font-bold tracking-tight">
            {r.onlineGifts > 0 ? `${Math.round((r.coveredFeeGifts / r.onlineGifts) * 100)}%` : "—"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.onlineGifts > 0
              ? `${r.coveredFeeGifts} of ${r.onlineGifts} online gifts included the processing fee.`
              : "No online gifts yet."}
          </p>
        </section>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Month</th>
              <th className="px-4 py-2.5 text-right font-medium">Total given</th>
              <th className="px-4 py-2.5 text-right font-medium">Online</th>
              <th className="px-4 py-2.5 text-right font-medium">Recurring</th>
              <th className="px-4 py-2.5 text-right font-medium">Fees</th>
              <th className="px-4 py-2.5 text-right font-medium">Net</th>
              <th className="px-4 py-2.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-2.5 text-right font-medium">Donors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((m) => (
              <tr key={m.month} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{MONTHS[Number(m.month.slice(5)) - 1]}</td>
                <td className="w-64 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${m.gross > 0 ? Math.max((m.gross / maxGross) * 100, 1.5) : 0}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-medium tabular-nums">{whole(m.gross)}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-xs tabular-nums">{whole(m.online)}</td>
                <td className="px-4 py-2 text-right text-xs tabular-nums">{whole(m.recurring)}</td>
                <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{money(m.fees)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{whole(m.net)}</td>
                <td className="px-4 py-2 text-right text-xs tabular-nums">{m.gifts}</td>
                <td className="px-4 py-2 text-right text-xs tabular-nums">{m.donors}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border bg-muted/30 font-medium">
            <tr>
              <td className="px-4 py-2">{year}</td>
              <td className="px-4 py-2 text-right tabular-nums">{whole(r.totals.gross)}</td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">{whole(r.totals.online)}</td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">{whole(r.totals.recurring)}</td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">{money(r.totals.fees)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{whole(r.totals.net)}</td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">{r.totals.gifts}</td>
              <td className="px-4 py-2 text-right text-xs tabular-nums">{r.donors}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
