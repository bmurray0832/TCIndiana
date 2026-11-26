import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SheetImport } from "@/components/import/SheetImport";
import { importableCenters } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DonationSheetImportPage() {
  const centers = await importableCenters();
  if (centers.length === 0) {
    return (
      <div className="p-6">
        <PageHeader
          title="Import a donation spreadsheet"
          subtitle="Your role is view-only, so importing isn't available. Ask an HQ admin if you need it."
        />
      </div>
    );
  }
  return (
    <div className="p-6">
      <Link href="/import" className="mb-3 inline-block text-xs text-muted-foreground hover:text-primary">
        ← Back to imports
      </Link>
      <PageHeader
        title="Import a donation spreadsheet"
        subtitle="For an Excel file with one tab per month and one row per gift (Date, Name, Amount, address, Method). Donors are created or matched for you, addresses are saved, and loading the same file twice adds nothing."
      />
      <SheetImport centers={centers} />
    </div>
  );
}
