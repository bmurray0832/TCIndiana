import Link from "next/link";
import { Users, DollarSign, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TOOLS = [
  {
    href: "/import/constituents",
    icon: Users,
    title: "Import Constituents",
    description: "People → Donors and Prospects. Always run this first.",
    kind: "CONSTITUENTS" as const,
  },
  {
    href: "/import/transactions",
    icon: DollarSign,
    title: "Import Transactions",
    description: "Gifts → Donations. Matched to existing constituents by ID.",
    kind: "TRANSACTIONS" as const,
  },
  {
    href: "/import/interactions",
    icon: MessageSquare,
    title: "Import Interactions",
    description: "Calls / emails / meetings → Contact Log entries.",
    kind: "INTERACTIONS" as const,
  },
];

export default async function ImportLandingPage() {
  const me = await getCurrentUser();
  const history = me
    ? await prisma.bloomerangImport.findMany({
        where: { organizationId: me.organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      })
    : [];

  return (
    <div className="p-6">
      <PageHeader
        title="Bloomerang import"
        subtitle="One-time CSV upload from Bloomerang. Re-runs are idempotent — re-uploading the same file updates existing records instead of creating duplicates."
      />

      <section className="grid gap-3 md:grid-cols-3">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-2 text-base font-semibold">{t.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">Recent imports</h2>
        {history.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No imports yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Kind</th>
                  <th className="px-4 py-2.5 font-medium">File</th>
                  <th className="px-4 py-2.5 font-medium">By</th>
                  <th className="px-4 py-2.5 text-right font-medium">Created</th>
                  <th className="px-4 py-2.5 text-right font-medium">Updated</th>
                  <th className="px-4 py-2.5 text-right font-medium">Skipped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(h.createdAt)}</td>
                    <td className="px-4 py-2 text-xs">{h.kind.toLowerCase()}</td>
                    <td className="px-4 py-2 text-xs">{h.filename ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{h.user?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{h.created}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{h.updated}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{h.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
