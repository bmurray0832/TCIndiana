"use client";

import { useTransition } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { selectCenterScope } from "@/lib/actions/center-scope";

export function CenterSelector({
  centers,
  selectedId,
}: {
  centers: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  if (centers.length <= 1) return null;

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:inline">
        Viewing
      </span>
      <span className="relative inline-flex items-center">
        <Building2 className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <select
          value={selectedId ?? ""}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              await selectCenterScope(e.target.value);
            })
          }
          className="appearance-none rounded-md border border-border bg-background py-1.5 pl-8 pr-7 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
        >
          <option value="">All centers</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </label>
  );
}
