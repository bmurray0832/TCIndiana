import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "good";
};

const TONE_BORDER: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-l-4 border-l-transparent",
  warning: "border-l-4 border-l-yellow-500",
  danger: "border-l-4 border-l-red-500",
  good: "border-l-4 border-l-green-600",
};

export function KpiCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-sm", TONE_BORDER[tone])}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
