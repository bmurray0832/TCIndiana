import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Campaign = { id: string; name: string; goal: number | null; raised: number; count: number };

export function CampaignProgressList({ campaigns }: { campaigns: Campaign[] }) {
  if (campaigns.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        No campaign activity this year.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {campaigns.map((c) => {
        const pct = c.goal ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : null;
        const barColor =
          pct === null
            ? "bg-primary/50"
            : pct >= 100
            ? "bg-green-600"
            : pct >= 75
            ? "bg-primary"
            : pct >= 30
            ? "bg-primary/70"
            : "bg-yellow-500";
        return (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground tabular-nums">
                <span className="font-semibold text-foreground">{formatCurrency(c.raised)}</span>
                {c.goal && (
                  <>
                    {" "}
                    of <span>{formatCurrency(c.goal)}</span>
                  </>
                )}
                {" · "}
                {c.count} {c.count === 1 ? "gift" : "gifts"}
              </div>
            </div>
            {pct !== null ? (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", barColor)}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-muted-foreground italic">No goal set</div>
            )}
            {pct !== null && (
              <div className="mt-1 text-[11px] text-muted-foreground">{pct}% to goal</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CampaignProgressHeader({ campaigns }: { campaigns: Campaign[] }) {
  const withGoals = campaigns.filter((c) => c.goal !== null);
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">Campaign progress</h2>
        <p className="text-xs text-muted-foreground">
          {withGoals.length} campaigns with goals · top {campaigns.length} this year
        </p>
      </div>
      <Link href="/reports/campaigns" className="text-xs font-medium text-primary hover:underline">
        Report →
      </Link>
    </header>
  );
}
