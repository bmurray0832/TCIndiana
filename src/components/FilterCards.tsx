"use client";

import { cn } from "@/lib/utils";

export type FilterCard = {
  /** Unique key — identifies the card and matches the `active` prop. */
  key: string;
  label: string;
  count: number | string;
  /** The filter set this card applies when clicked. Empty object = clear all. */
  filters: Record<string, string>;
  /** Optional left-border accent for visual grouping. */
  tone?: "default" | "good" | "warning" | "danger" | "info" | "hot" | "warm" | "cold";
};

const TONE_BORDER: Record<NonNullable<FilterCard["tone"]>, string> = {
  default: "border-l-transparent",
  good: "border-l-green-600",
  warning: "border-l-yellow-500",
  danger: "border-l-red-500",
  info: "border-l-blue-500",
  hot: "border-l-red-500",
  warm: "border-l-orange-500",
  cold: "border-l-blue-500",
};

function eq(a: Record<string, string>, b: Record<string, string>) {
  const ak = Object.keys(a).filter((k) => a[k]);
  const bk = Object.keys(b).filter((k) => b[k]);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

export function FilterCards({
  cards,
  active,
  onPick,
}: {
  cards: FilterCard[];
  active: Record<string, string>;
  onPick: (filters: Record<string, string>) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => {
        const isActive = eq(active, c.filters);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.filters)}
            className={cn(
              "rounded-lg border bg-card p-3 text-left transition-all border-l-4",
              TONE_BORDER[c.tone ?? "default"],
              isActive
                ? "border-primary ring-2 ring-primary/30 shadow-sm"
                : "border-border hover:border-primary/40 hover:shadow-sm",
            )}
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums">{c.count}</div>
          </button>
        );
      })}
    </div>
  );
}
