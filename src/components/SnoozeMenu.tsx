"use client";

import { useState, useTransition } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { snoozePerson } from "@/lib/actions/follow-ups";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 0, label: "Clear snooze" },
];

export function SnoozeMenu({ personId, snoozedUntil }: { personId: string; snoozedUntil: Date | string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isSnoozed = snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();

  function pick(days: number) {
    setOpen(false);
    startTransition(async () => {
      await snoozePerson(personId, days);
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium hover:bg-muted",
          isSnoozed && "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
        )}
      >
        <Clock className="h-3 w-3" />
        {isSnoozed ? "Snoozed" : "Snooze"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-border bg-card shadow-lg">
            <ul className="py-1 text-xs">
              {OPTIONS.map((o) => (
                <li key={o.days}>
                  <button
                    type="button"
                    onClick={() => pick(o.days)}
                    className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
