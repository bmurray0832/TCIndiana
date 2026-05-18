import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { AlertBadge } from "@/components/AlertBadge";
import { listPeople } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PRIORITY: Record<string, number> = { RED: 3, ORANGE: 2, YELLOW: 1, GREEN: 0 };

export default async function FollowUpsPage() {
  const all = await listPeople({ kind: "all" });
  const queue = all
    .filter((p) => p.alertColor !== "GREEN")
    .sort((a, b) => {
      const byAlert = PRIORITY[b.alertColor] - PRIORITY[a.alertColor];
      if (byAlert !== 0) return byAlert;
      return Number(b.lifetimeAmount) - Number(a.lifetimeAmount);
    });

  return (
    <div className="p-6">
      <PageHeader
        title="Follow-Up Queue"
        subtitle={`${queue.length} action items · sorted by alert color, then lifetime giving`}
      />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Last contact</th>
              <th className="px-4 py-2.5 text-right font-medium">Days out</th>
              <th className="px-4 py-2.5 text-right font-medium">Lifetime</th>
              <th className="px-4 py-2.5 font-medium">Alert</th>
              <th className="px-4 py-2.5 font-medium">Center</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {queue.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Empty queue — everybody is current. 🎉
                </td>
              </tr>
            ) : (
              queue.map((p) => {
                const isDonor = !!p.convertedToDonorAt;
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link href={`/people/${p.id}`} className="font-medium hover:text-primary">
                        {p.firstName} {p.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs">{isDonor ? "Donor" : "Prospect"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(p.lastContactAt)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{p.daysSinceContact ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {isDonor ? formatCurrency(Number(p.lifetimeAmount)) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <AlertBadge color={p.alertColor} />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{p.center.name}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
