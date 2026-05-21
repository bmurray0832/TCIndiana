import { PageHeader } from "@/components/PageHeader";
import { FollowUpsTable } from "@/components/tables/FollowUpsTable";
import { listPeople, currentUserSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const [all, me] = await Promise.all([listPeople({ kind: "all" }), currentUserSummary()]);
  const queue = all.filter((p) => p.alertColor !== "GREEN");

  return (
    <div className="p-6">
      <PageHeader
        title="Follow-Up Queue"
        subtitle={`${queue.length} action items · sort and filter to focus the queue`}
      />
      <FollowUpsTable people={queue} centerNames={me.centers.map((c) => c.name)} />
    </div>
  );
}
