import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function PipelineSummary({
  cold,
  warm,
  hot,
  recentConversions,
}: {
  cold: number;
  warm: number;
  hot: number;
  recentConversions: number;
}) {
  const total = cold + warm + hot;
  const conversionRate =
    total + recentConversions > 0
      ? Math.round((recentConversions / (total + recentConversions)) * 100)
      : 0;

  return (
    <div>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Snapshot today · conversions in the last 90 days
          </p>
        </div>
        <Link href="/reports/funnel" className="text-xs font-medium text-primary hover:underline">
          Funnel →
        </Link>
      </header>

      <div className="flex items-center gap-2 p-4">
        <Stage label="Cold" count={cold} tone="cold" />
        <Arrow />
        <Stage label="Warm" count={warm} tone="warm" />
        <Arrow />
        <Stage label="Hot" count={hot} tone="hot" />
        <Arrow />
        <Stage label="Donor" count={recentConversions} tone="donor" highlight />
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs">Conversion rate (90d)</span>
          </div>
          <div>
            <span className="text-lg font-bold tabular-nums">{conversionRate}%</span>
            <span className="ml-1 text-xs text-muted-foreground">
              {recentConversions} of {total + recentConversions}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stage({
  label,
  count,
  tone,
  highlight,
}: {
  label: string;
  count: number;
  tone: "cold" | "warm" | "hot" | "donor";
  highlight?: boolean;
}) {
  const colors = {
    cold: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    warm: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    hot: "bg-red-500/15 text-red-700 dark:text-red-300",
    donor: "bg-green-500/15 text-green-700 dark:text-green-300",
  }[tone];
  return (
    <div className={`flex-1 rounded-md ${highlight ? "ring-2 ring-primary/30" : ""} ${colors} p-2 text-center`}>
      <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{count}</div>
    </div>
  );
}

function Arrow() {
  return <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/60" />;
}
