import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { AlertBadge } from "@/components/AlertBadge";
import { listPeople } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BiggestSupportersPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const sp = await searchParams;
  const n = Math.max(5, Math.min(200, Number(sp.n) || 25));

  const donors = await listPeople({ kind: "donor" });
  const top = donors
    .slice()
    .sort((a, b) => Number(b.lifetimeAmount) - Number(a.lifetimeAmount))
    .slice(0, n);

  const totalShown = top.reduce((s, p) => s + Number(p.lifetimeAmount), 0);
  const totalAll = donors.reduce((s, p) => s + Number(p.lifetimeAmount), 0);
  const sharePct = totalAll > 0 ? Math.round((totalShown / totalAll) * 100) : 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Biggest Supporters"
        subtitle={`Top ${top.length} donors · ${formatCurrency(totalShown)} (${sharePct}% of all lifetime giving)`}
        actions={
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
        }
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Donor</th>
              <th className="px-4 py-2.5 text-right font-medium">Lifetime</th>
              <th className="px-4 py-2.5 text-right font-medium">This year</th>
              <th className="px-4 py-2.5 font-medium">Last gift</th>
              <th className="px-4 py-2.5 font-medium">Last contact</th>
              <th className="px-4 py-2.5 text-right font-medium">Days out</th>
              <th className="px-4 py-2.5 font-medium">Alert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {top.map((p, i) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="px-4 py-2">
                  <Link href={`/people/${p.id}`} className="font-medium hover:text-primary">
                    {p.firstName} {p.lastName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{p.center.name}</div>
                </td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(Number(p.lifetimeAmount))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">
                  {formatCurrency(Number(p.ytdAmount))}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(p.lastDonationAt)}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(p.lastContactAt)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{p.daysSinceContact ?? "—"}</td>
                <td className="px-4 py-2">
                  <AlertBadge color={p.alertColor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
