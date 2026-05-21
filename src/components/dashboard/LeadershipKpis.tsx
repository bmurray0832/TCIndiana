import { TrendingUp, TrendingDown, Minus, UserPlus, Repeat, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Props = {
  ytd: number;
  ytdLastYear: number;
  ytdChange: number | null;
  monthTotal: number;
  monthChange: number | null;
  newDonorsThisMonth: number;
  retentionRate: number;
  cohortSize: number;
  retainedCount: number;
};

export function LeadershipKpis(p: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <BigKpi
        icon={Calendar}
        label="This year"
        value={formatCurrency(p.ytd)}
        change={p.ytdChange}
        hint={`Last year same period: ${formatCurrency(p.ytdLastYear)}`}
      />
      <BigKpi
        icon={Calendar}
        label="This month"
        value={formatCurrency(p.monthTotal)}
        change={p.monthChange}
        hint="vs. last month"
      />
      <BigKpi
        icon={UserPlus}
        label="New donors this month"
        value={p.newDonorsThisMonth}
        hint="First-time gifts in the last 30 days"
      />
      <BigKpi
        icon={Repeat}
        label="Donor retention"
        value={`${p.retentionRate}%`}
        hint={`${p.retainedCount} of ${p.cohortSize} last-year donors gave again`}
        tone={p.retentionRate >= 50 ? "good" : p.retentionRate >= 30 ? "warning" : "danger"}
      />
    </div>
  );
}

function BigKpi({
  icon: Icon,
  label,
  value,
  change,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  change?: number | null;
  hint?: string;
  tone?: "good" | "warning" | "danger";
}) {
  const trendColor =
    change == null
      ? "text-muted-foreground"
      : change > 0
      ? "text-green-600"
      : change < 0
      ? "text-red-600"
      : "text-muted-foreground";
  const Trend = change == null ? Minus : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const border =
    tone === "good"
      ? "border-l-green-600"
      : tone === "warning"
      ? "border-l-yellow-500"
      : tone === "danger"
      ? "border-l-red-500"
      : "border-l-primary/50";

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 border-l-4 shadow-sm", border)}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {change != null && (
          <div className={cn("flex items-center gap-0.5 text-sm font-medium tabular-nums", trendColor)}>
            <Trend className="h-3.5 w-3.5" />
            {change > 0 ? "+" : ""}{change}%
          </div>
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
