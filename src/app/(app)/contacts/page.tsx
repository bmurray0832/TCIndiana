import { PageHeader } from "@/components/PageHeader";
import { ContactLogTable } from "@/components/tables/ContactLogTable";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const centerIds = await getAccessibleCenterIds();
  const contacts = await prisma.contact.findMany({
    where: { centerId: { in: centerIds } },
    orderBy: { date: "desc" },
    take: 500,
    include: {
      person: { select: { id: true, firstName: true, lastName: true } },
      staff: { select: { name: true } },
    },
  });

  return (
    <div className="p-6">
      <PageHeader title="Contact Log" subtitle={`${contacts.length} most-recent entries`} />
      <ContactLogTable contacts={contacts} />
    </div>
  );
}
