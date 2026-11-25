import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
import { importableCenters } from "@/lib/queries";
import type { ImportKindLower } from "@/lib/import/types";

const TITLES: Record<ImportKindLower, { title: string; subtitle: string }> = {
  constituents: {
    title: "Import Constituents",
    subtitle: "Bloomerang Constituents → People (donors + prospects). Run this before transactions or interactions so the linking IDs exist.",
  },
  transactions: {
    title: "Import Transactions",
    subtitle: "Bloomerang Transactions → Donations. Each row is matched to a constituent by ID; un-matched rows are skipped.",
  },
  interactions: {
    title: "Import Interactions",
    subtitle: "Bloomerang Interactions → Contact Log entries. Match by constituent ID.",
  },
};

function isValidKind(k: string): k is ImportKindLower {
  return k === "constituents" || k === "transactions" || k === "interactions";
}

export default async function ImportKindPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isValidKind(kind)) notFound();
  const meta = TITLES[kind];
  const centers = await importableCenters();
  if (centers.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title={meta.title} subtitle="Your role is view-only, so importing isn't available. Ask an HQ admin if you need it." />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link href="/import" className="mb-3 inline-block text-xs text-muted-foreground hover:text-primary">
        ← Back to imports
      </Link>
      <PageHeader title={meta.title} subtitle={meta.subtitle} />
      <ImportWizard kind={kind} centers={centers} />
    </div>
  );
}
