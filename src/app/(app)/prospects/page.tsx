import { PageHeader } from "@/components/PageHeader";
import { PeopleTable } from "@/components/PeopleTable";
import { NewPersonButton } from "@/components/NewPersonButton";
import { listPeople, currentUserSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const [people, me] = await Promise.all([
    listPeople({ kind: "prospect" }),
    currentUserSummary(),
  ]);
  const hot = people.filter((p) => p.interestLevel === "HOT").length;
  const warm = people.filter((p) => p.interestLevel === "WARM").length;
  const cold = people.filter((p) => p.interestLevel === "COLD").length;
  const red = people.filter((p) => p.alertColor === "RED").length;

  return (
    <div className="p-6">
      <PageHeader
        title="Prospects"
        subtitle={`${people.length} total · ${hot} hot · ${warm} warm · ${cold} cold · ${red} going cold`}
        actions={<NewPersonButton centers={me.centers} variant="prospect" />}
      />
      <PeopleTable people={people} variant="prospect" />
    </div>
  );
}
