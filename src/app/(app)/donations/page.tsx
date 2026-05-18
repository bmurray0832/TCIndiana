import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds } from "@/lib/auth-dev";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DonationsPage() {
  const centerIds = await getAccessibleCenterIds();
  const donations = await prisma.donation.findMany({
    where: { centerId: { in: centerIds } },
    orderBy: { date: "desc" },
    take: 200,
    include: {
      person: { select: { id: true, firstName: true, lastName: true } },
      campaign: { select: { name: true } },
    },
  });

  const total = donations.reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="p-6">
      <PageHeader
        title="Donations"
        subtitle={`${donations.length} entries · ${formatCurrency(total)} shown`}
      />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Donor</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Campaign</th>
              <th className="px-4 py-2.5 font-medium">Payment</th>
              <th className="px-4 py-2.5 font-medium">Receipt</th>
              <th className="px-4 py-2.5 font-medium">Thank you</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {donations.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No donations recorded yet.
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
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(Number(d.amount))}
                  </td>
                  <td className="px-4 py-2 text-xs">{d.campaign?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{d.paymentMethod.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-4 py-2 text-xs">{d.receiptSent ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-xs">{d.thankYouSent ? "✓" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
