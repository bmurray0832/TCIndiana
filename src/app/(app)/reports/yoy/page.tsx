import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ReportActions } from "@/components/reports/ReportActions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveCenterIds } from "@/lib/auth";
import { parsePeriodKind, resolvePeriod, periodOptions, type PeriodKind } from "@/lib/periods";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABELS: { kind: PeriodKind; label: string }[] = [
  { kind: "month", label: "Month" },
  { kind: "quarter", label: "Quarter" },
  { kind: "year", label: "Year" },
];

export default async function YoYReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; value?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) return null;

  const kind = parsePeriodKind(sp.period);
  // `year` is the legacy param — still honored so old links keep working.
  const p = resolvePeriod(kind, sp.value ?? sp.year);
  const options = periodOptions(kind);

  const centerIds = await getActiveCenterIds();
  const centers = await prisma.center.findMany({
    where: { id: { in: centerIds } },
    orderBy: { name: "asc" },
  });

  async function rangeStats(centerId: string, start: Date, end: Date) {
    const agg = await prisma.donation.aggregate({
      where: { centerId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    });
    const count = await prisma.donation.count({
      where: { centerId, date: { gte: start, lt: end } },
    });
    const donorIds = await prisma.donation.findMany({
      where: { centerId, date: { gte: start, lt: end } },
      select: { personId: true },
      distinct: ["personId"],
    });
    return {
      total: Number(agg._sum.amount ?? 0),
      count,
      donors: donorIds.length,
    };
  }

  const rows = await Promise.all(
    centers.map(async (c) => {
      const [curr, prev] = await Promise.all([
        rangeStats(c.id, p.currStart, p.currEnd),
        rangeStats(c.id, p.prevStart, p.prevEnd),
      ]);
      const change = prev.total > 0 ? Math.round(((curr.total - prev.total) / prev.total) * 100) : null;
      return { center: c, curr, prev, change };
    }),
  );

  const totals = rows.reduce(
    (acc, r) => ({
      currTotal: acc.currTotal + r.curr.total,
      currCount: acc.currCount + r.curr.count,
      currDonors: acc.currDonors + r.curr.donors,
      prevTotal: acc.prevTotal + r.prev.total,
      prevCount: acc.prevCount + r.prev.count,
      prevDonors: acc.prevDonors + r.prev.donors,
    }),
    { currTotal: 0, currCount: 0, currDonors: 0, prevTotal: 0, prevCount: 0, prevDonors: 0 },
  );
  const totalChange = totals.prevTotal > 0
    ? Math.round(((totals.currTotal - totals.prevTotal) / totals.prevTotal) * 100)
    : null;

  const maxRaised = Math.max(...rows.flatMap((r) => [r.curr.total, r.prev.total]), 1);

  const csvRows = rows.map(({ center, curr, prev, change }) => ({
    center: center.name,
    [`raised ${p.currLabel}`]: curr.total,
    [`gifts ${p.currLabel}`]: curr.count,
    [`donors ${p.currLabel}`]: curr.donors,
    [`raised ${p.prevLabel}`]: prev.total,
    [`gifts ${p.prevLabel}`]: prev.count,
    [`donors ${p.prevLabel}`]: prev.donors,
    changePct: change,
  }));

  return (
    <div className="p-6">
      <PageHeader
        title="Year-over-Year by Center"
        subtitle={`${p.currLabel} vs ${p.prevLabel}`}
        actions={
          <>
          <ReportActions rows={csvRows} filename={`yoy-by-center-${p.slug}`} />
          <div className="flex items-center rounded-md border border-border bg-card p-0.5 print:hidden">
            {KIND_LABELS.map(({ kind: k, label }) => (
              <Link
                key={k}
                href={`?period=${k}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  k === kind ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
          <form action="" className="flex items-center gap-2 print:hidden">
            <input type="hidden" name="period" value={kind} />
            <select
              name="value"
              defaultValue={p.value}
              aria-label={`Select ${kind}`}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="submit" className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
              Go
            </button>
          </form>
          </>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th rowSpan={2} className="px-4 py-2.5 font-medium align-bottom">Center</th>
              <th colSpan={3} className="px-4 py-1.5 text-center font-medium border-b border-border">{p.currLabel}</th>
              <th colSpan={3} className="px-4 py-1.5 text-center font-medium border-b border-border border-l">{p.prevLabel}</th>
              <th rowSpan={2} className="px-4 py-2.5 text-right font-medium align-bottom border-l">YoY $</th>
            </tr>
            <tr>
              <th className="px-4 py-1.5 text-right font-medium">Raised</th>
              <th className="px-4 py-1.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-1.5 text-right font-medium">Donors</th>
              <th className="px-4 py-1.5 text-right font-medium border-l">Raised</th>
              <th className="px-4 py-1.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-1.5 text-right font-medium">Donors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ center, curr, prev, change }) => (
              <tr key={center.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{center.name}</td>
                <td className="w-56 px-4 py-2">
                  <RaisedBar value={curr.total} max={maxRaised} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{curr.count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{curr.donors}</td>
                <td className="w-56 px-4 py-2 border-l">
                  <RaisedBar value={prev.total} max={maxRaised} muted />
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">{prev.count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">{prev.donors}</td>
                <td className={cn("px-4 py-2 text-right tabular-nums text-xs font-medium border-l", changeClass(change))}>
                  {change === null ? "—" : `${change > 0 ? "+" : ""}${change}%`}
                </td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totals.currTotal)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs">{totals.currCount}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs">{totals.currDonors}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs border-l">{formatCurrency(totals.prevTotal)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs">{totals.prevCount}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs">{totals.prevDonors}</td>
              <td className={cn("px-4 py-2.5 text-right tabular-nums text-xs border-l", changeClass(totalChange))}>
                {totalChange === null ? "—" : `${totalChange > 0 ? "+" : ""}${totalChange}%`}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RaisedBar({ value, max, muted }: { value: number; max: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={muted ? "h-full rounded-full bg-primary/30" : "h-full rounded-full bg-primary/70"}
          style={{ width: `${Math.max((value / max) * 100, value > 0 ? 1.5 : 0)}%` }}
        />
      </div>
      <span className={cn("w-20 shrink-0 text-right tabular-nums", muted ? "text-xs text-muted-foreground" : "font-medium")}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function changeClass(c: number | null): string {
  if (c === null) return "text-muted-foreground";
  if (c > 0) return "text-green-600";
  if (c < 0) return "text-red-600";
  return "text-muted-foreground";
}
