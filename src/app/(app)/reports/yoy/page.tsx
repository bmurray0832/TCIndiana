import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getAccessibleCenterIds } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function YoYReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) return null;

  const now = new Date();
  const thisYear = Number(sp.year) || now.getFullYear();
  const lastYear = thisYear - 1;

  const centerIds = await getAccessibleCenterIds();
  const centers = await prisma.center.findMany({
    where: { id: { in: centerIds } },
    orderBy: { name: "asc" },
  });

  async function rangeStats(centerId: string, year: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
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
      const [curr, prev] = await Promise.all([rangeStats(c.id, thisYear), rangeStats(c.id, lastYear)]);
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

  const yearOptions: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) yearOptions.push(y);

  return (
    <div className="p-6">
      <PageHeader
        title="Year-over-Year by Center"
        subtitle={`${thisYear} vs ${lastYear}`}
        actions={
          <form action="" className="flex items-center gap-2">
            <label htmlFor="year" className="text-xs text-muted-foreground">Year</label>
            <select
              id="year"
              name="year"
              defaultValue={thisYear}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="submit" className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
              Go
            </button>
          </form>
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th rowSpan={2} className="px-4 py-2.5 font-medium align-bottom">Center</th>
              <th colSpan={3} className="px-4 py-1.5 text-center font-medium border-b border-border">{thisYear}</th>
              <th colSpan={3} className="px-4 py-1.5 text-center font-medium border-b border-border border-l">{lastYear}</th>
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
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(curr.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{curr.count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{curr.donors}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground border-l">{formatCurrency(prev.total)}</td>
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

function changeClass(c: number | null): string {
  if (c === null) return "text-muted-foreground";
  if (c > 0) return "text-green-600";
  if (c < 0) return "text-red-600";
  return "text-muted-foreground";
}
