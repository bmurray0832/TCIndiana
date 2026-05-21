import { PageHeader } from "@/components/PageHeader";
import { DonationsTable } from "@/components/tables/DonationsTable";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DonationsPage() {
  const me = await getCurrentUser();
  const centerIds = await getAccessibleCenterIds();
  const [donations, campaigns] = await Promise.all([
    prisma.donation.findMany({
      where: { centerId: { in: centerIds } },
      orderBy: { date: "desc" },
      take: 500,
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { name: true } },
      },
    }),
    me
      ? prisma.campaign.findMany({
          where: { organizationId: me.organizationId },
          select: { name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const total = donations.reduce((s, d) => s + Number(d.amount), 0);
  return (
    <div className="p-6">
      <PageHeader
        title="Donations"
        subtitle={`${donations.length} entries · ${formatCurrency(total)} shown`}
      />
      <DonationsTable donations={donations} campaigns={campaigns.map((c) => c.name)} />
    </div>
  );
}
