import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ReportActions } from "@/components/reports/ReportActions";
import { getAccessibleCenterIds, getActiveCenterIds, getCurrentUser } from "@/lib/auth";
import { parseYear, yearEndStatements, yearEndSummary } from "@/lib/year-end";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default async function YearEndPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const me = await getCurrentUser();
  if (!me) return null;
  const year = parseYear((await searchParams).year);
  const thisYear = new Date().getUTCFullYear();

  // The summary always shows every center the user can see, so the
  // state total sits next to each center. The donor list follows the
  // center picked in the top bar.
  const [summary, statements] = await Promise.all([
    yearEndSummary(await getAccessibleCenterIds(), year),
    yearEndStatements(await getActiveCenterIds(), year),
  ]);
  const totalLabel = me.orgRole === "ORG_ADMIN" ? "Statewide total" : "All your centers";
  const rows = [{ key: "total", name: totalLabel, ...summary.total }, ...summary.centers.map((c) => ({ key: c.centerId, ...c }))];

  const csvRows = statements.map((s) => ({
    donor: s.name,
    email: s.email,
    center: s.centerName,
    gifts: s.gifts.length,
    total: s.total,
  }));

  return (
    <div className="p-6">
      <PageHeader
        title="Year-End Giving"
        subtitle={`${year} · totals for the state and each center, and a giving statement for every donor`}
        actions={
          <div className="flex items-center gap-2">
            <form action="" className="print:hidden">
              <select
                name="year"
                defaultValue={year}
                aria-label="Year"
                className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
              >
                {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button type="submit" className="ml-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">
                Show
              </button>
            </form>
            <ReportActions rows={csvRows} filename={`year-end-donors-${year}`} />
          </div>
        }
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Center</th>
              <th className="px-4 py-2.5 text-right font-medium">Total given</th>
              <th className="px-4 py-2.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-2.5 text-right font-medium">Donors</th>
              <th className="px-4 py-2.5 text-right font-medium">Average gift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key} className={r.key === "total" ? "bg-muted/30 font-semibold" : "hover:bg-muted/30"}>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(r.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.gifts}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.donors}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.gifts > 0 ? money(r.total / r.gifts) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-base font-semibold">Giving statements</h2>
          <p className="text-xs text-muted-foreground">
            {statements.length} {statements.length === 1 ? "donor" : "donors"} gave in {year}. Pick a center in the top bar
            to narrow the list.
          </p>
        </div>
        {statements.length > 0 && (
          <Link
            href={`/reports/year-end/statements?year=${year}`}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Print all statements
          </Link>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card print:hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Donor</th>
              <th className="px-4 py-2.5 font-medium">Center</th>
              <th className="px-4 py-2.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {statements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No gifts recorded in {year}.
                </td>
              </tr>
            ) : (
              statements.map((s) => (
                <tr key={s.personId} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link href={`/people/${s.personId}`} className="font-medium hover:text-primary">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{s.centerName}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs">{s.gifts.length}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(s.total)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/reports/year-end/statements?year=${year}&person=${s.personId}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Statement
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
