import type { Statement } from "@/lib/year-end";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
// Gift dates are stored as calendar dates; print them as stored.
const day = (d: Date) =>
  d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });

/** One donor's year-end giving statement, sized to print on a page. */
export function GivingStatement({
  statement: s,
  year,
  orgName,
  taxId,
}: {
  statement: Statement;
  year: number;
  orgName: string;
  taxId: string | null;
}) {
  return (
    <article className="mx-auto max-w-2xl break-after-page rounded-lg border border-border bg-card p-8 text-sm print:max-w-none print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-6 border-b border-border pb-4">
        <div>
          <div className="text-lg font-bold">{orgName}</div>
          <div className="text-muted-foreground">{s.centerName}</div>
          {s.centerAddress && <div className="text-muted-foreground">{s.centerAddress}</div>}
          {taxId && <div className="text-muted-foreground">Tax ID (EIN): {taxId}</div>}
        </div>
        <div className="text-right">
          <div className="text-base font-semibold">{year} Giving Statement</div>
          <div className="text-muted-foreground">January 1 – December 31, {year}</div>
        </div>
      </header>

      <div className="mt-5">
        <div className="font-medium">{s.name}</div>
        {s.address.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {s.email && <div className="text-muted-foreground">{s.email}</div>}
        {s.doNotMail && <div className="text-xs font-medium text-red-700 print:hidden">Do not mail</div>}
      </div>

      <p className="mt-5">
        Thank you for your generosity. Below is a record of the gifts we received from you in {year}.
      </p>

      <table className="mt-4 w-full">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Fund / campaign</th>
            <th className="py-2 font-medium">Method</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {s.gifts.map((g, i) => (
            <tr key={i}>
              <td className="py-1.5">{day(g.date)}</td>
              <td className="py-1.5">{g.campaign ?? "General"}</td>
              <td className="py-1.5 capitalize">{g.method}</td>
              <td className="py-1.5 text-right tabular-nums">{money(g.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border font-semibold">
          <tr>
            <td className="py-2" colSpan={3}>
              Total for {year}
            </td>
            <td className="py-2 text-right tabular-nums">{money(s.total)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-6 text-xs text-muted-foreground">
        No goods or services were provided in exchange for these contributions. Please keep this statement for
        your tax records.
      </p>
    </article>
  );
}
