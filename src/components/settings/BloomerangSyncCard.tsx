"use client";

import { useActionState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { syncBloomerang, type BloomerangSyncState } from "@/lib/actions/integrations";

type Props = {
  configured: boolean;
  centers: { id: string; name: string }[];
  defaultCenterId: string | null;
  lastSyncAt: string | null;
};

export function BloomerangSyncCard({ configured, centers, defaultCenterId, lastSyncAt }: Props) {
  const [state, action, pending] = useActionState<BloomerangSyncState, FormData>(syncBloomerang, null);
  const last = state?.ok ? state.ranAt : lastSyncAt;

  return (
    <section className="mb-3 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Bloomerang</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pulls constituents, gifts and interactions straight from Bloomerang. Read-only: nothing here is
            ever written back, and prospects you add in this CRM are never touched by a sync.
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

          {!configured ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Set <code className="font-mono">BLOOMERANG_API_KEY</code> on the server to enable. A Bloomerang
              administrator creates the key under User Settings.
            </p>
          ) : (
            <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">New constituents land in</span>
                <select
                  name="centerId"
                  defaultValue={defaultCenterId ?? ""}
                  required
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
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
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="submit"
                name="full"
                value="1"
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                Full re-sync
              </button>
            </form>
          )}

          {pending && (
            <p className="mt-3 text-xs text-muted-foreground">
              Reading from Bloomerang. A first sync can take a few minutes — keep this tab open.
            </p>
          )}
          {state && !state.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {state.error}
            </div>
          )}
          {state?.ok && (
            <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-900/40 dark:bg-green-950/40 dark:text-green-200">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                {state.full ? "Full sync complete" : "Sync complete"}
              </div>
              <ul className="mt-1 text-xs">
                {(["constituents", "transactions", "interactions"] as const).map((k) => (
                  <li key={k}>
                    <span className="capitalize">{k === "transactions" ? "Gifts" : k}</span>: {state[k].created} new,{" "}
                    {state[k].updated} updated
                    {state[k].skipped > 0 && `, ${state[k].skipped} skipped`}
                  </li>
                ))}
              </ul>
              {state.errorCount > 0 && (
                <p className="mt-1 text-xs">
                  {state.errorCount} rows had problems — see Import history for details.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
