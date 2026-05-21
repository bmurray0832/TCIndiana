import { PageHeader } from "@/components/PageHeader";
import { DonationsPageBody } from "@/components/pages/DonationsPageBody";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds, getCurrentUser } from "@/lib/auth";

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

  return (
    <div className="p-6">
      <PageHeader
        title="Donations"
        subtitle="Click a card below to focus the table."
      />
      <DonationsPageBody donations={donations} campaigns={campaigns.map((c) => c.name)} />
    </div>
  );
}
