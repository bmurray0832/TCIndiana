import { formatCurrency } from "@/lib/utils";

type Bucket = { label: string; total: number; month: number; year: number };

/** Plain-SVG 12-month bar chart. Avoids the recharts dep on the
 *  dashboard — small enough that a few svg rects do the job. */
export function MonthlyTrendChart({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((b) => b.total), 1);
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const avg = Math.round(total / buckets.length);

  // SVG layout
  const w = 600;
  const h = 200;
  const barGap = 6;
  const barW = (w - barGap * (buckets.length + 1)) / buckets.length;
  const innerH = h - 40;

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">12-month giving</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums">{formatCurrency(total)}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          Avg <span className="font-medium text-foreground tabular-nums">{formatCurrency(avg)}</span> / mo
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" preserveAspectRatio="none">
        {buckets.map((b, i) => {
          const barH = (b.total / max) * innerH;
          const x = barGap + i * (barW + barGap);
          const y = innerH - barH + 10;
          const isCurrent = b.month === thisMonth && b.year === thisYear;
          return (
            <g key={`${b.year}-${b.month}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={3}
                className={isCurrent ? "fill-primary" : "fill-primary/30"}
              >
                <title>{`${b.label} ${b.year} — ${formatCurrency(b.total)}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={h - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
