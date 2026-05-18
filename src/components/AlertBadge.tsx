import { ALERT_TAILWIND } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { AlertColor } from "@/generated/prisma";

export function AlertDot({ color }: { color: AlertColor }) {
  const c = ALERT_TAILWIND[color];
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", c.dot)} aria-label={color} />;
}

export function AlertBadge({ color, label }: { color: AlertColor; label?: string }) {
  const c = ALERT_TAILWIND[color];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        c.bg,
        c.text,
        c.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {label ?? color.charAt(0) + color.slice(1).toLowerCase()}
    </span>
  );
}
