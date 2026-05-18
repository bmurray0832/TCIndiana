import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { AlertBadge } from "@/components/AlertBadge";
import { dashboardMetrics, currentUserSummary } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [m, me] = await Promise.all([dashboardMetrics(), currentUserSummary()]);
  const centerNames = me.centers.map((c) => c.name).join(" · ") || "No centers assigned";

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        subtitle={`${me.user?.name ?? "Signed-out"} · ${centerNames}`}
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Donors" value={m.donors} tone="good" />
        <KpiCard label="Prospects" value={m.prospects} />
        <KpiCard label="YTD $" value={formatCurrency(m.ytd)} tone="good" />
        <KpiCard label="Avg gift" value={formatCurrency(m.avgGift)} />
        <KpiCard label="Contacts / mo" value={m.contactsThisMonth} />
        <KpiCard label="Red donors" value={m.redDonors} tone={m.redDonors > 0 ? "danger" : "default"} />
        <KpiCard label="Red prospects" value={m.redProspects} tone={m.redProspects > 0 ? "warning" : "default"} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">⚠️ Needing attention</h2>
              <p className="text-xs text-muted-foreground">Red + Orange · top by lifetime giving</p>
            </div>
            <Link href="/follow-ups" className="text-xs font-medium text-primary hover:underline">
              View queue →
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {m.needingAttention.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nobody&apos;s overdue. Nice.
              </li>
            ) : (
              m.needingAttention.map((p) => {
                const isDonor = !!p.convertedToDonorAt;
                return (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div className="min-w-0">
                      <Link
                        href={`/people/${p.id}`}
                        className="block truncate text-sm font-medium hover:text-primary"
                      >
                        {p.firstName} {p.lastName}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{isDonor ? "Donor" : "Prospect"}</span>
                        <span>·</span>
                        <span>{p.daysSinceContact ?? "never"} days out</span>
                        <span>·</span>
                        <span>{p.center.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isDonor && (
                        <span className="text-sm font-medium tabular-nums">
                          {formatCurrency(Number(p.lifetimeAmount))}
                        </span>
                      )}
                      <AlertBadge color={p.alertColor} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Recent donations</h2>
              <p className="text-xs text-muted-foreground">Last 8</p>
            </div>
            <Link href="/donations" className="text-xs font-medium text-primary hover:underline">
              All →
            </Link>
          </header>
          <ul className="divide-y divide-border">
            {m.recentDonations.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">No donations yet.</li>
            ) : (
              m.recentDonations.map((d) => (
                <li key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <Link href={`/people/${d.person.id}`} className="text-sm font-medium hover:text-primary">
                      {d.person.firstName} {d.person.lastName}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(d.date)} · {d.campaign?.name ?? "—"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(d.amount))}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
