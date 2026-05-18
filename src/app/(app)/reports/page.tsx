import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

type Report = { name: string; phase: string; href?: string; description: string };

const REPORTS: Report[] = [
  {
    name: "Monthly Donation Report",
    phase: "Phase 1",
    href: "/reports/monthly",
    description: "Total, count, average, largest gift, contacts logged. Picker for any month.",
  },
  {
    name: "Campaign Performance",
    phase: "Phase 1.5",
    description: "$ raised per campaign, % to goal, by month.",
  },
  {
    name: "Biggest Supporters",
    phase: "Phase 1.5",
    description: "Top N donors by lifetime, with last-contact recency overlay.",
  },
  {
    name: "Donor Retention",
    phase: "Phase 2",
    description: "What % of last year's donors gave this year?",
  },
  {
    name: "YoY by Center",
    phase: "Phase 2",
    description: "Side-by-side comparison of each center's giving.",
  },
  {
    name: "Pipeline Funnel",
    phase: "Phase 2",
    description: "Cold → Warm → Hot → Donor conversion rates over the last 90 days.",
  },
];

export default function ReportsPage() {
  return (
    <div className="p-6">
      <PageHeader title="Reports" subtitle="One report per page — filters at top, KPIs strip, drilldown table." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const card = (
            <div className={`h-full rounded-lg border ${r.href ? "border-border bg-card hover:border-primary/40" : "border-dashed border-border bg-card"} p-5 transition-colors`}>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.phase}</div>
              <div className="mt-1 text-base font-semibold">{r.name}</div>
              <p className="mt-2 text-xs text-muted-foreground">{r.description}</p>
              {r.href && (
                <p className="mt-3 text-xs font-medium text-primary">Open report →</p>
              )}
            </div>
          );
          return r.href ? (
            <Link key={r.name} href={r.href} className="block">{card}</Link>
          ) : (
            <div key={r.name}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
