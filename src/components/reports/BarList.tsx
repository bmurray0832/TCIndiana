/** Horizontal bar list for reports — server-rendered, no chart lib.
 *  Each item gets a labeled row with a proportional bar; an optional
 *  `secondary` value renders a comparison bar underneath (e.g. last
 *  year vs this year). */

type Item = {
  label: string;
  value: number;
  display: string;
  secondary?: { value: number; display: string; label?: string };
};

export function BarList({ items, title }: { items: Item[]; title?: string }) {
  const max = Math.max(...items.map((i) => Math.max(i.value, i.secondary?.value ?? 0)), 1);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {title && (
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{item.label}</span>
              <span className="shrink-0 tabular-nums text-xs">
                {item.display}
                {item.secondary && (
                  <span className="ml-2 text-muted-foreground">
                    {item.secondary.label ? `${item.secondary.label}: ` : "vs "}
                    {item.secondary.display}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 1 : 0)}%` }}
              />
            </div>
            {item.secondary && (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/35"
                  style={{
                    width: `${Math.max((item.secondary.value / max) * 100, item.secondary.value > 0 ? 1 : 0)}%`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
