import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { ReportActions } from "@/components/reports/ReportActions";
import { prisma } from "@/lib/prisma";
import { getActiveCenterIds } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RetentionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ cohortYear?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const cohortYear = Number(sp.cohortYear) || now.getFullYear() - 1;
  const followYear = cohortYear + 1;

  const cohortStart = new Date(cohortYear, 0, 1);
  const cohortEnd = new Date(cohortYear + 1, 0, 1);
  const followStart = new Date(followYear, 0, 1);
  const followEnd = new Date(followYear + 1, 0, 1);

  const centerIds = await getActiveCenterIds();

  // Donors who gave at least once during the cohort year.
  const cohortDonations = await prisma.donation.findMany({
    where: { centerId: { in: centerIds }, date: { gte: cohortStart, lt: cohortEnd } },
    select: { personId: true, amount: true },
  });
  const cohortMap = new Map<string, number>();
  for (const d of cohortDonations) {
    cohortMap.set(d.personId, (cohortMap.get(d.personId) ?? 0) + Number(d.amount));
  }
  const cohortIds = Array.from(cohortMap.keys());

  // Of those, who gave at least once in the following year.
  const retainedDonations = cohortIds.length
    ? await prisma.donation.findMany({
        where: {
          personId: { in: cohortIds },
          centerId: { in: centerIds },
          date: { gte: followStart, lt: followEnd },
        },
        select: { personId: true, amount: true },
      })
    : [];
  const retainedMap = new Map<string, number>();
  for (const d of retainedDonations) {
    retainedMap.set(d.personId, (retainedMap.get(d.personId) ?? 0) + Number(d.amount));
  }
  const retainedIds = new Set(retainedMap.keys());

  const cohortSize = cohortIds.length;
  const retainedCount = retainedIds.size;
  const retentionRate = cohortSize > 0 ? Math.round((retainedCount / cohortSize) * 100) : 0;
  const cohortRevenue = Array.from(cohortMap.values()).reduce((s, v) => s + v, 0);
  const retainedRevenue = Array.from(retainedMap.values()).reduce((s, v) => s + v, 0);

  const cohortPeople = cohortIds.length
    ? await prisma.person.findMany({
        where: { id: { in: cohortIds } },
        select: { id: true, firstName: true, lastName: true, lastContactAt: true },
      })
    : [];

  const lapsed = cohortPeople
    .filter((p) => !retainedIds.has(p.id))
    .map((p) => ({ ...p, cohortGiving: cohortMap.get(p.id) ?? 0 }))
    .sort((a, b) => b.cohortGiving - a.cohortGiving);

  const yearOptions: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) yearOptions.push(y - 1);

  // CSV covers every lapsed donor, not just the 50 shown on screen —
  // this is the list staff will work through for re-engagement.
  const csvRows = lapsed.map((p) => ({
    firstName: p.firstName,
    lastName: p.lastName,
    [`giving${cohortYear}`]: p.cohortGiving,
    lastContact: p.lastContactAt ? new Date(p.lastContactAt).toISOString().slice(0, 10) : null,
  }));

  return (
    <div className="p-6">
      <PageHeader
        title="Donor Retention"
        subtitle={`What % of donors who gave in ${cohortYear} also gave in ${followYear}?`}
        actions={
          <>
          <ReportActions rows={csvRows} filename={`lapsed-donors-${cohortYear}-cohort`} />
          <form action="" className="flex items-center gap-2">
            <label htmlFor="cohortYear" className="text-xs text-muted-foreground">Cohort year</label>
            <select
              id="cohortYear"
              name="cohortYear"
              defaultValue={cohortYear}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="submit" className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
              Go
            </button>
          </form>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={`Donors in ${cohortYear}`} value={cohortSize} />
        <KpiCard label={`Also gave in ${followYear}`} value={retainedCount} />
        <KpiCard
          label="Retention rate"
          value={`${retentionRate}%`}
          tone={retentionRate >= 50 ? "good" : retentionRate >= 30 ? "warning" : "danger"}
        />
        <KpiCard label="Lapsed (need re-engaging)" value={lapsed.length} tone={lapsed.length > 0 ? "warning" : "default"} />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <KpiCard label={`${cohortYear} revenue from this cohort`} value={formatCurrency(cohortRevenue)} />
        <KpiCard label={`${followYear} revenue from this cohort`} value={formatCurrency(retainedRevenue)} />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Lapsed donors</h2>
          <p className="text-xs text-muted-foreground">
            Gave in {cohortYear} but not in {followYear}. Sorted by {cohortYear} giving.
          </p>
        </header>
        {lapsed.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Everyone in this cohort gave again. Nice.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Donor</th>
                <th className="px-4 py-2.5 text-right font-medium">{cohortYear} giving</th>
                <th className="px-4 py-2.5 font-medium">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lapsed.slice(0, 50).map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/people/${p.id}`} className="font-medium hover:text-primary">
                      {p.firstName} {p.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(p.cohortGiving)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {p.lastContactAt ? new Date(p.lastContactAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
