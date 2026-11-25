import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { GivingStatement } from "@/components/reports/GivingStatement";
import { getAccessibleCenterIds, getActiveCenterIds, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseYear, yearEndStatements } from "@/lib/year-end";

export const dynamic = "force-dynamic";

/** Printable giving statements: one donor (?person=) or every donor in
 *  the centers currently selected. Each statement prints on its own page. */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; person?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return null;
  const sp = await searchParams;
  const year = parseYear(sp.year);

  // One donor: any center the user may see. Everyone: the selected centers.
  const centerIds = sp.person ? await getAccessibleCenterIds() : await getActiveCenterIds();
  const [statements, org] = await Promise.all([
    yearEndStatements(centerIds, year, sp.person),
    prisma.organization.findUnique({ where: { id: me.organizationId }, select: { name: true } }),
  ]);
  const taxId = process.env.ORG_TAX_ID?.trim() || null;

  return (
    <div className="p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between gap-4 print:hidden">
        <Link href={`/reports/year-end?year=${year}`} className="text-xs text-muted-foreground hover:text-primary">
          ← Back to Year-End Giving
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {statements.length} {statements.length === 1 ? "statement" : "statements"} · one per page
          </span>
          <PrintButton />
        </div>
      </div>

      {statements.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No gifts found for {year}.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {statements.map((s) => (
            <GivingStatement key={s.personId} statement={s} year={year} orgName={org?.name ?? ""} taxId={taxId} />
          ))}
        </div>
      )}
    </div>
  );
}
