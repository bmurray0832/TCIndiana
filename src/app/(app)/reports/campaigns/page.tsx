import { PageHeader } from "@/components/PageHeader";
import { ReportActions } from "@/components/reports/ReportActions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getActiveCenterIds } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CampaignsReportPage() {
  const me = await getCurrentUser();
  if (!me) return null;
  const centerIds = await getActiveCenterIds();

  const campaigns = await prisma.campaign.findMany({
    where: {
      organizationId: me.organizationId,
      OR: [{ centerId: null }, { centerId: { in: centerIds } }],
    },
    orderBy: { name: "asc" },
  });

  const stats = await Promise.all(
    campaigns.map(async (c) => {
      const agg = await prisma.donation.aggregate({
        where: { campaignId: c.id, centerId: { in: centerIds } },
        _sum: { amount: true },
        _avg: { amount: true },
        _max: { date: true },
      });
      const count = await prisma.donation.count({
        where: { campaignId: c.id, centerId: { in: centerIds } },
      });
      return {
        campaign: c,
        total: Number(agg._sum.amount ?? 0),
        avg: Math.round(Number(agg._avg.amount ?? 0)),
        count,
        lastGift: agg._max.date,
      };
    }),
  );

  // Sort descending by total
  stats.sort((a, b) => b.total - a.total);

  const grandTotal = stats.reduce((s, x) => s + x.total, 0);

  const csvRows = stats.map(({ campaign, total, avg, count, lastGift }) => {
    const goal = Number(campaign.goalAmount ?? 0);
    return {
      campaign: campaign.name,
      raised: total,
      goal: goal > 0 ? goal : null,
      pctToGoal: goal > 0 ? Math.round((total / goal) * 100) : null,
      gifts: count,
      avgGift: avg,
      lastGift: lastGift ? new Date(lastGift).toISOString().slice(0, 10) : null,
    };
  });

  return (
    <div className="p-6">
      <PageHeader
        title="Campaign Performance"
        subtitle={`${stats.length} campaigns · ${formatCurrency(grandTotal)} raised across all`}
        actions={<ReportActions rows={csvRows} filename="campaign-performance" />}
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Campaign</th>
              <th className="px-4 py-2.5 text-right font-medium">Raised</th>
              <th className="px-4 py-2.5 text-right font-medium">Goal</th>
              <th className="px-4 py-2.5 text-right font-medium">% to goal</th>
              <th className="px-4 py-2.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-2.5 text-right font-medium">Avg gift</th>
              <th className="px-4 py-2.5 font-medium">Last gift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stats.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No campaigns yet.
                </td>
              </tr>
            ) : (
              stats.map(({ campaign, total, avg, count, lastGift }) => {
                const goal = Number(campaign.goalAmount ?? 0);
                const pct = goal > 0 ? Math.round((total / goal) * 100) : null;
                const maxTotal = Math.max(...stats.map((s) => s.total), 1);
                return (
                  <tr key={campaign.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{campaign.name}</div>
                      {!campaign.active && (
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Archived</div>
                      )}
                    </td>
                    <td className="w-64 px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${Math.max((total / maxTotal) * 100, total > 0 ? 1.5 : 0)}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right font-medium tabular-nums">{formatCurrency(total)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {goal > 0 ? formatCurrency(goal) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">
                      {pct === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={pct >= 100 ? "text-green-600 font-medium" : pct >= 50 ? "" : "text-muted-foreground"}>
                          {pct}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{count}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{formatCurrency(avg)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(lastGift)}</td>
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
