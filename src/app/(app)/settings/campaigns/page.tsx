import { PageHeader } from "@/components/PageHeader";
import { CampaignsList } from "@/components/settings/CampaignsList";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CampaignsSettingsPage() {
  const me = await getCurrentUser();
  if (!me) return null;
  if (me.orgRole !== "ORG_ADMIN") {
    return <div className="text-sm text-muted-foreground">HQ admins only.</div>;
  }

  const [rawCampaigns, centers] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId: me.organizationId },
      include: {
        center: { select: { id: true, name: true } },
        donations: { select: { amount: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.center.findMany({
      where: { organizationId: me.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const campaigns = rawCampaigns.map((c) => ({
    ...c,
    donationCount: c.donations.length,
    raised: c.donations.reduce((s, d) => s + Number(d.amount), 0),
  }));

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle={`${campaigns.length} campaigns · used to tag donations and drive the donation page`}
      />
      <CampaignsList campaigns={campaigns} centers={centers} />
    </>
  );
}
