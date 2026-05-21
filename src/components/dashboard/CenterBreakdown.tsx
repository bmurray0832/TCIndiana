import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  ytd: number;
  ytdLastYear: number;
  change: number | null;
  count: number;
};

export function CenterBreakdown({ centers }: { centers: Row[] }) {
  const max = Math.max(...centers.map((c) => c.ytd), 1);

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">By center · YTD</h2>
        <p className="text-xs text-muted-foreground">Compared to same period last year</p>
      </header>
      <ul className="divide-y divide-border">
        {centers.map((c) => {
          const pct = (c.ytd / max) * 100;
          return (
            <li key={c.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <div className="font-medium">{c.name}</div>
                <div className="flex items-baseline gap-3 text-xs">
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatCurrency(c.ytd)}
                  </span>
                  {c.change !== null && (
                    <span
                      className={cn(
                        "tabular-nums",
                        c.change > 0 ? "text-green-600" : c.change < 0 ? "text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {c.change > 0 ? "+" : ""}{c.change}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${Math.max(1, pct)}%` }}
                />
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                {c.count} {c.count === 1 ? "gift" : "gifts"} · last year: {formatCurrency(c.ytdLastYear)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
