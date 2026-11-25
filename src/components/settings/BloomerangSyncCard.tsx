"use client";

import { useActionState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { syncBloomerang, type BloomerangSyncState } from "@/lib/actions/integrations";

type Props = {
  configured: boolean;
  centers: { id: string; name: string }[];
  defaultCenterId: string | null;
  lastSyncAt: string | null;
  centerField: string | null;
  mappings: { id: string; value: string; centerId: string | null; nameMatchId: string | null }[];
};

const input = "rounded-md border border-border bg-background px-2 py-1.5 text-sm";
const secondary =
  "rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60";

export function BloomerangSyncCard({ configured, centers, defaultCenterId, lastSyncAt, centerField, mappings }: Props) {
  const [state, action, pending] = useActionState<BloomerangSyncState, FormData>(syncBloomerang, null);
  const summary = state?.ok && "ranAt" in state ? state : null;
  const last = summary?.ranAt ?? lastSyncAt;
  const centerName = (id: string | null) => centers.find((c) => c.id === id)?.name;

  return (
    <section className="mb-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Bloomerang</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pulls constituents, gifts and interactions straight from Bloomerang every night. Read-only: nothing
            here is ever written back, and prospects you add in this CRM are never touched by a sync.
          </p>
          <p className="mt-2 text-xs">
            {last ? (
              <>
                Last synced <span className="font-medium">{new Date(last).toLocaleString()}</span>
              </>
            ) : (
              "Not synced yet."
            )}
          </p>
          {!configured && (
            <p className="mt-2 text-xs text-muted-foreground">
              Syncing is off until <code className="font-mono">BLOOMERANG_API_KEY</code> is set on the server. A
              Bloomerang administrator creates the key under User Settings. You can set up the centers below in
              the meantime.
            </p>
          )}

          {/* Re-mount when saved values change so the fields show what was saved. */}
          <form
            key={[defaultCenterId, centerField, ...mappings.map((m) => `${m.id}:${m.centerId}`)].join("|")}
            action={action}
            className="mt-4 space-y-4"
          >
            <div className="flex flex-wrap gap-4">
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Default center</span>
                <select name="centerId" defaultValue={defaultCenterId ?? ""} required className={input}>
                  <option value="" disabled>
                    Choose a center
                  </option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">Bloomerang field that names the center</span>
                <input
                  name="centerField"
                  defaultValue={centerField ?? ""}
                  placeholder="e.g. Center"
                  className={`${input} w-56`}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              If constituents in Bloomerang have a custom field saying which center they belong to, enter its
              label. Values that match a center&rsquo;s name are placed automatically; everyone else lands in the
              default center, where staff can move them.
            </p>

            {mappings.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Value seen in Bloomerang</th>
                      <th className="px-3 py-2 font-medium">Goes to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="px-3 py-2">{m.value}</td>
                        <td className="px-3 py-2">
                          <select name={`map:${m.id}`} defaultValue={m.centerId ?? ""} className={input}>
                            <option value="">
                              {m.nameMatchId
                                ? `${centerName(m.nameMatchId)} (matched by name)`
                                : "Default center (no match)"}
                            </option>
                            {centers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" disabled={pending} className={secondary}>
                Save
              </button>
              {configured && (
                <>
                  <button
                    type="submit"
                    name="intent"
                    value="sync"
                    disabled={pending}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {pending ? "Working…" : "Save and sync now"}
                  </button>
                  <button type="submit" name="intent" value="full" disabled={pending} className={secondary}>
                    Full re-sync
                  </button>
                  <span className="text-xs text-muted-foreground">
                    Run a full re-sync after changing where a value goes.
                  </span>
                </>
              )}
            </div>
          </form>

          {pending && (
            <p className="mt-3 text-xs text-muted-foreground">
              A first sync can take a few minutes — keep this tab open.
            </p>
          )}
          {state && !state.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {state.error}
            </div>
          )}
          {state?.ok && !summary && (
            <p className="mt-3 flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" /> Saved.
            </p>
          )}
          {summary && (
            <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {summary.full ? "Full sync complete" : "Sync complete"}
              </div>
              <ul className="mt-1 text-xs">
                {(["constituents", "transactions", "interactions"] as const).map((k) => (
                  <li key={k}>
                    <span className="capitalize">{k === "transactions" ? "Gifts" : k}</span>: {summary[k].created} new,{" "}
                    {summary[k].updated} updated
                    {summary[k].skipped > 0 && `, ${summary[k].skipped} skipped`}
                  </li>
                ))}
              </ul>
              {summary.errorCount > 0 && (
                <p className="mt-1 text-xs">{summary.errorCount} rows had problems — see Import history for details.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
