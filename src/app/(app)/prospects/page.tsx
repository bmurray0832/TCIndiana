import { PageHeader } from "@/components/PageHeader";
import { ProspectsPageBody } from "@/components/pages/ProspectsPageBody";
import { NewPersonButton } from "@/components/NewPersonButton";
import { listPeople, currentUserSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const [people, me] = await Promise.all([
    listPeople({ kind: "prospect" }),
    currentUserSummary(),
  ]);

  return (
    <div className="p-6">
      <PageHeader
        title="Prospects"
        subtitle="Click a card below to focus the table. Use search and column filters to drill deeper."
        actions={<NewPersonButton centers={me.centers} variant="prospect" />}
      />
      <ProspectsPageBody people={people} centerNames={me.centers.map((c) => c.name)} />
    </div>
  );
}
