import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getAccessibleCenterIds } from "@/lib/auth-dev";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const centerIds = await getAccessibleCenterIds();
  const contacts = await prisma.contact.findMany({
    where: { centerId: { in: centerIds } },
    orderBy: { date: "desc" },
    take: 200,
    include: {
      person: { select: { id: true, firstName: true, lastName: true } },
      staff: { select: { name: true } },
    },
  });

  return (
    <div className="p-6">
      <PageHeader title="Contact Log" subtitle={`${contacts.length} most-recent entries`} />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Outcome</th>
              <th className="px-4 py-2.5 font-medium">Staff</th>
              <th className="px-4 py-2.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No contacts logged yet.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(c.date)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/people/${c.person.id}`} className="font-medium hover:text-primary">
                      {c.person.firstName} {c.person.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs">{c.contactType.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-4 py-2 text-xs">{c.outcome.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{c.staff?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{c.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
