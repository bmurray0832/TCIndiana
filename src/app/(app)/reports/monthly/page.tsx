import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds } from "@/lib/auth-dev";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseMonth(m: string | undefined): { start: Date; end: Date; label: string } {
  const now = new Date();
  const [yStr, mStr] = (m ?? "").split("-");
  const year = Number(yStr) || now.getFullYear();
  const monthIndex = (Number(mStr) || now.getMonth() + 1) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 1);
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { start, end, label };
}

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    out.push({ value, label });
  }
  return out;
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const { start, end, label } = parseMonth(sp.month);
  const centerIds = await getAccessibleCenterIds();
  const where = { centerId: { in: centerIds }, date: { gte: start, lt: end } };

  const [agg, count, max, donations, contactsCount] = await Promise.all([
    prisma.donation.aggregate({ where, _sum: { amount: true }, _avg: { amount: true } }),
    prisma.donation.count({ where }),
    prisma.donation.findFirst({
      where,
      orderBy: { amount: "desc" },
      include: { person: { select: { firstName: true, lastName: true } } },
    }),
    prisma.donation.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
    }),
    prisma.contact.count({ where: { centerId: { in: centerIds }, date: { gte: start, lt: end } } }),
  ]);

  const total = Number(agg._sum.amount ?? 0);
  const avg = Math.round(Number(agg._avg.amount ?? 0));
  const options = monthOptions();
  const currentValue = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="p-6">
      <PageHeader
        title="Monthly Donation Report"
        subtitle={label}
        actions={
          <form action="" className="flex items-center gap-2">
            <label htmlFor="month" className="text-xs text-muted-foreground">Month</label>
            <select
              id="month"
              name="month"
              defaultValue={currentValue}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button type="submit" className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted">
              Go
            </button>
          </form>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Total" value={formatCurrency(total)} tone="good" />
        <KpiCard label="Count" value={count} />
        <KpiCard label="Average" value={formatCurrency(avg)} />
        <KpiCard
          label="Largest"
          value={max ? formatCurrency(Number(max.amount)) : "—"}
          hint={max ? `${max.person.firstName} ${max.person.lastName}` : undefined}
        />
        <KpiCard label="Contacts" value={contactsCount} />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Donations</h2>
          <p className="text-xs text-muted-foreground">{donations.length} entries in {label}</p>
        </header>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Donor</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Campaign</th>
              <th className="px-4 py-2.5 font-medium">Payment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {donations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No donations in {label}.
                </td>
              </tr>
            ) : (
              donations.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(d.date)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/people/${d.person.id}`} className="font-medium hover:text-primary">
                      {d.person.firstName} {d.person.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {formatCurrency(Number(d.amount))}
                  </td>
                  <td className="px-4 py-2 text-xs">{d.campaign?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{d.paymentMethod.replace(/_/g, " ").toLowerCase()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
