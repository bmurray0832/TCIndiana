import { PageHeader } from "@/components/PageHeader";
import { DonorsPageBody } from "@/components/pages/DonorsPageBody";
import { NewPersonButton } from "@/components/NewPersonButton";
import { listPeople, currentUserSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  const [people, me] = await Promise.all([
    listPeople({ kind: "donor" }),
    currentUserSummary(),
  ]);

  return (
    <div className="p-6">
      <PageHeader
        title="Donors"
        subtitle="Click a card below to focus the table."
        actions={<NewPersonButton centers={me.centers} variant="donor" />}
      />
      <DonorsPageBody people={people} centerNames={me.centers.map((c) => c.name)} />
    </div>
  );
}
