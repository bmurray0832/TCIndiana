import { PageHeader } from "@/components/PageHeader";
import { ContactsPageBody } from "@/components/pages/ContactsPageBody";
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
      <PageHeader
        title="Contact Log"
        subtitle="Click a card below to focus the log."
      />
      <ContactsPageBody contacts={contacts} />
    </div>
  );
}
