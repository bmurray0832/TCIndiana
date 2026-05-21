import { CenterSelector } from "@/components/CenterSelector";
import { getCenterScope } from "@/lib/center-scope";

/** Slim top bar above the main content. Currently houses the global
 *  center filter; future items (search, notifications) can attach here. */
export async function TopBar() {
  const { centers, selected } = await getCenterScope();
  if (centers.length <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-3 border-b border-border bg-card px-6 py-2">
      <CenterSelector centers={centers} selectedId={selected?.id ?? null} />
    </div>
  );
}
