import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AlertBadge } from "@/components/AlertBadge";
import { PrintButton } from "@/components/PrintButton";
import { executiveReport, type PeriodStats } from "@/lib/executive-report";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { AlertColor } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export default async function ExecutiveReportPage() {
  const r = await executiveReport();
  if (!r) return <div className="p-6 text-sm text-muted-foreground">No data yet.</div>;

  return (
    <div className="p-6 print:p-0">
      <PageHeader
        title="Executive Report"
        subtitle={`${r.centers.map((c) => c.name).join(" · ")} · generated ${r.generatedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
        actions={<PrintButton />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <PeriodCard stats={r.month} period="This Month" />
        <PeriodCard stats={r.quarter} period="This Quarter" />
        <PeriodCard stats={r.year} period="This Year" highlighted />
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <HighlightCard title="Biggest supporters" subtitle="Top 5 by lifetime giving">
          {r.highlights.biggestSupporters.length === 0 ? (
            <Empty>No donors yet.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {r.highlights.biggestSupporters.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <Link href={`/people/${p.id}`} className="text-sm font-medium hover:text-primary">
                    {p.name}
                  </Link>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{formatCurrency(p.lifetime)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Last gift {formatDate(p.lastDonationAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HighlightCard>

        <HighlightCard title="Needs attention" subtitle="Red + Orange · top by lifetime">
          {r.highlights.needingAttention.length === 0 ? (
            <Empty>Everyone is current.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {r.highlights.needingAttention.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/people/${p.id}`} className="block truncate text-sm font-medium hover:text-primary">
                      {p.name}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">
                      {p.isDonor ? "Donor" : "Prospect"} · {p.daysSinceContact ?? "never"}d out
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {p.isDonor && (
                      <span className="text-xs font-medium tabular-nums">{formatCurrency(p.lifetime)}</span>
                    )}
                    <AlertBadge color={p.alert as AlertColor} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HighlightCard>

        <HighlightCard title="Recent conversions" subtitle="Prospect → donor, this year">
          {r.highlights.recentConversions.length === 0 ? (
            <Empty>No new conversions yet this year.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {r.highlights.recentConversions.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <Link href={`/people/${p.id}`} className="text-sm font-medium hover:text-primary">
                    {p.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">{formatDate(p.date)}</div>
                </li>
              ))}
            </ul>
          )}
        </HighlightCard>
      </section>

      <p className="mt-6 text-center text-[11px] text-muted-foreground print:mt-3">
        Teen Challenge Indiana CRM · Executive Report · {r.generatedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
      </p>
    </div>
  );
}

function PeriodCard({ stats, period, highlighted }: { stats: PeriodStats; period: string; highlighted?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card",
        highlighted ? "border-primary/40 shadow-sm" : "border-border",
      )}
    >
      <header className={cn("border-b px-4 py-3", highlighted ? "border-primary/40 bg-primary/5" : "border-border")}>
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{period}</h2>
            <p className="mt-0.5 text-sm font-medium text-foreground">{stats.range.label}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{formatCurrency(stats.total)}</div>
            <div className="flex items-center justify-end gap-2 text-[11px] tabular-nums">
              <DeltaPill label="vs prior" pct={stats.vsPrior.pct} />
              <DeltaPill label="vs last yr" pct={stats.vsLastYear.pct} />
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 px-4 py-3">
        <Stat label="Gifts" value={stats.count} />
        <Stat label="Average" value={formatCurrency(stats.avg)} />
        <Stat label="Unique donors" value={stats.uniqueDonors} />
        <Stat label="New donors" value={stats.newDonors} />
        <Stat label="Contacts logged" value={stats.contacts} />
        <Stat
          label="Largest gift"
          value={stats.largest ? formatCurrency(stats.largest.amount) : "—"}
          hint={stats.largest?.donor}
        />
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Top campaigns
        </div>
        {stats.topCampaigns.length === 0 ? (
          <div className="text-xs text-muted-foreground">No gifts in this period.</div>
        ) : (
          <ul className="space-y-1.5">
            {stats.topCampaigns.map((c) => (
              <li key={c.name} className="flex items-baseline justify-between text-sm">
                <span className="truncate">{c.name}</span>
                <span className="ml-2 flex-shrink-0 tabular-nums text-xs">
                  <span className="font-semibold">{formatCurrency(c.raised)}</span>
                  <span className="ml-1 text-muted-foreground">· {c.count}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DeltaPill({ label, pct }: { label: string; pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        {label}
      </span>
    );
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const color = pct > 0 ? "text-green-600" : pct < 0 ? "text-red-600" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-0.5", color)}>
      <Icon className="h-3 w-3" />
      {pct > 0 ? "+" : ""}{pct}%
      <span className="ml-1 font-normal text-muted-foreground">{label}</span>
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

function HighlightCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-xs text-muted-foreground">{children}</div>;
}
