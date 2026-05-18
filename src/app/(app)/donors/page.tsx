import { PageHeader } from "@/components/PageHeader";
import { PeopleTable } from "@/components/PeopleTable";
import { NewPersonButton } from "@/components/NewPersonButton";
import { listPeople, currentUserSummary } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DonorsPage() {
  const [people, me] = await Promise.all([
    listPeople({ kind: "donor" }),
    currentUserSummary(),
  ]);
  const totalLifetime = people.reduce((s, p) => s + Number(p.lifetimeAmount), 0);
  const red = people.filter((p) => p.alertColor === "RED").length;

  return (
    <div className="p-6">
      <PageHeader
        title="Donors"
        subtitle={`${people.length} total · ${red} need attention · ${formatCurrency(totalLifetime)} lifetime giving`}
        actions={<NewPersonButton centers={me.centers} variant="donor" />}
      />
      <PeopleTable people={people} variant="donor" />
    </div>
  );
}
