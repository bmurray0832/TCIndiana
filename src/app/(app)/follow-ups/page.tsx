import { PageHeader } from "@/components/PageHeader";
import { FollowUpsPageBody } from "@/components/pages/FollowUpsPageBody";
import { listPeople, currentUserSummary } from "@/lib/queries";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const [all, me] = await Promise.all([listPeople({ kind: "all" }), currentUserSummary()]);
  const queue = all.filter((p) => p.alertColor !== "GREEN");

  const centerIds = me.centers.map((c) => c.id);
  const campaigns = await prisma.campaign.findMany({
    where: {
      active: true,
      OR: [{ centerId: null }, { centerId: { in: centerIds } }],
    },
    select: { id: true, name: true, centerId: true },
    orderBy: { name: "asc" },
  });
  const campaignsByCenter: Record<string, { id: string; name: string }[]> = {};
  for (const c of campaigns) {
    const key = c.centerId ?? "_org";
    (campaignsByCenter[key] ??= []).push({ id: c.id, name: c.name });
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Follow-Up Queue"
        subtitle="Click a row to see contact info. Use the action buttons to call, text, email, or log an outcome — every action resets the last-contact date."
      />
      <FollowUpsPageBody
        people={queue}
        centerNames={me.centers.map((c) => c.name)}
        campaignsByCenter={campaignsByCenter}
      />
    </div>
  );
}
