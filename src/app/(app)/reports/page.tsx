import { PageHeader } from "@/components/PageHeader";

const REPORTS = [
  { name: "Monthly Donation Report", phase: "Phase 1" },
  { name: "Campaign Performance", phase: "Phase 1" },
  { name: "Donor Retention", phase: "Phase 2" },
  { name: "YoY by Center", phase: "Phase 2" },
  { name: "Pipeline Funnel", phase: "Phase 2" },
  { name: "Biggest Supporters", phase: "Phase 1" },
];

export default function ReportsPage() {
  return (
    <div className="p-6">
      <PageHeader title="Reports" subtitle="Coming next — each report is one page, filters at top, KPIs strip, chart, drilldown table, CSV/PDF export." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.name} className="rounded-lg border border-dashed border-border bg-card p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.phase}</div>
            <div className="mt-1 text-base font-semibold">{r.name}</div>
            <p className="mt-2 text-xs text-muted-foreground">Not yet implemented.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
