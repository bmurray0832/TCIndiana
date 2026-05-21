"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { CampaignForm } from "@/components/forms/CampaignForm";
import { setCampaignActive } from "@/lib/actions/admin";
import { formatCurrency } from "@/lib/utils";
import type { Campaign } from "@/generated/prisma";

type Row = Campaign & {
  donationCount: number;
  raised: number;
  center: { id: string; name: string } | null;
};

export function CampaignsList({
  campaigns,
  centers,
}: {
  campaigns: Row[];
  centers: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(c: Campaign) {
    startTransition(async () => {
      await setCampaignActive(c.id, !c.active);
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add campaign
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Center</th>
              <th className="px-4 py-2.5 text-right font-medium">Goal</th>
              <th className="px-4 py-2.5 text-right font-medium">Raised</th>
              <th className="px-4 py-2.5 text-right font-medium">% to goal</th>
              <th className="px-4 py-2.5 text-right font-medium">Gifts</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No campaigns yet. Add one to start tagging donations.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const goal = Number(c.goalAmount ?? 0);
                const pct = goal > 0 ? Math.round((c.raised / goal) * 100) : null;
                return (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="font-medium">{c.name}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {c.center?.name ?? <span className="italic">org-wide</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground tabular-nums">
                      {goal > 0 ? formatCurrency(goal) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums">{formatCurrency(c.raised)}</td>
                    <td className="px-4 py-2 text-right text-xs">
                      {pct === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={pct >= 100 ? "text-green-600 font-medium" : pct >= 50 ? "" : "text-muted-foreground"}>
                          {pct}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-xs">{c.donationCount}</td>
                    <td className="px-4 py-2 text-xs">
                      {c.active ? <span className="text-green-600">Active</span> : <span className="text-muted-foreground">Archived</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="mr-2 text-xs font-medium text-primary hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(c)}
                        disabled={pending}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {c.active ? "Archive" : "Restore"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add campaign" size="lg">
        <CampaignForm centers={centers} onCancel={() => setAdding(false)} onSuccess={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && <CampaignForm campaign={editing} centers={centers} onCancel={() => setEditing(null)} onSuccess={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
