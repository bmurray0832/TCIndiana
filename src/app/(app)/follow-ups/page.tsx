import { PageHeader } from "@/components/PageHeader";
import { FollowUpsPageBody } from "@/components/pages/FollowUpsPageBody";
import { listPeople, currentUserSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const [all, me] = await Promise.all([listPeople({ kind: "all" }), currentUserSummary()]);
  const queue = all.filter((p) => p.alertColor !== "GREEN");

  return (
    <div className="p-6">
      <PageHeader
        title="Follow-Up Queue"
        subtitle="Click a card below to focus the queue by urgency or by type."
      />
      <FollowUpsPageBody people={queue} centerNames={me.centers.map((c) => c.name)} />
    </div>
  );
}
