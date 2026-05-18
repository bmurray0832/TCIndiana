import Link from "next/link";
import { AlertBadge } from "@/components/AlertBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { INTEREST_TAILWIND, DONOR_STATUS_TAILWIND } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { PersonWithAlert } from "@/lib/queries";

type Variant = "donor" | "prospect";

export function PeopleTable({ people, variant }: { people: PersonWithAlert[]; variant: Variant }) {
  if (people.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        No {variant === "donor" ? "donors" : "prospects"} yet. Run <code>npm run db:seed</code> to load the
        sample workbook.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-left">
          <tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">{variant === "donor" ? "Status" : "Interest"}</th>
            {variant === "donor" && <th className="px-4 py-2.5 text-right font-medium">Lifetime</th>}
            {variant === "donor" && <th className="px-4 py-2.5 text-right font-medium">YoY</th>}
            <th className="px-4 py-2.5 font-medium">Last contact</th>
            <th className="px-4 py-2.5 text-right font-medium">Days out</th>
            <th className="px-4 py-2.5 font-medium">Alert</th>
            <th className="px-4 py-2.5 font-medium">Center</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {people.map((p) => {
            const yoy = Number(p.ytdAmount) - Number(p.lastYearAmount);
            return (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <Link href={`/people/${p.id}`} className="font-medium hover:text-primary">
                    {p.firstName} {p.lastName}
                  </Link>
                  {p.email && <div className="text-xs text-muted-foreground">{p.email}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {variant === "donor" ? (
                    p.donorStatus ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                          DONOR_STATUS_TAILWIND[p.donorStatus],
                        )}
                      >
                        {p.donorStatus.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )
                  ) : p.interestLevel ? (
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                        INTEREST_TAILWIND[p.interestLevel],
                      )}
                    >
                      {p.interestLevel}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                {variant === "donor" && (
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatCurrency(Number(p.lifetimeAmount))}
                  </td>
                )}
                {variant === "donor" && (
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right text-xs tabular-nums",
                      yoy > 0 ? "text-green-600" : yoy < 0 ? "text-red-600" : "text-muted-foreground",
                    )}
                  >
                    {yoy === 0 ? "—" : `${yoy > 0 ? "+" : ""}${formatCurrency(yoy)}`}
                  </td>
                )}
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {formatDate(p.lastContactAt)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                  {p.daysSinceContact ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <AlertBadge color={p.alertColor} />
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.center.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
