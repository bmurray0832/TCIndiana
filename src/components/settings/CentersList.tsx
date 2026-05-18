"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { CenterForm } from "@/components/forms/CenterForm";
import { ThresholdsForm } from "@/components/forms/ThresholdsForm";
import { effectiveThresholds, type AlertThresholds } from "@/lib/alerts";
import type { Center } from "@/generated/prisma";

type Row = Center & { hasOverride: boolean; effective: AlertThresholds };

export function CentersList({
  centers,
  orgDefaults,
  canCreate,
}: {
  centers: Center[];
  orgDefaults: AlertThresholds;
  canCreate: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Center | null>(null);
  const [thresholding, setThresholding] = useState<Row | null>(null);

  const rows: Row[] = centers.map((c) => ({
    ...c,
    hasOverride: !!c.alertThresholds,
    effective: effectiveThresholds(orgDefaults, c.alertThresholds),
  }));

  return (
    <>
      {canCreate && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add center
          </button>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  /{c.slug} · donation page /give/{c.donationPageSlug ?? c.slug}
                  {c.address && <> · {c.address}</>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setThresholding(c)}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  Thresholds
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-4">
              <ThresholdSwatch label="Donor Y/O/R" value={`${c.effective.donor.yellow} / ${c.effective.donor.orange} / ${c.effective.donor.red}`} />
              <ThresholdSwatch label="Prospect Y/O/R" value={`${c.effective.prospect.yellow} / ${c.effective.prospect.orange} / ${c.effective.prospect.red}`} />
              <ThresholdSwatch label="Source" value={c.hasOverride ? "Center override" : "Org defaults"} />
              {c.brandColor && (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-border"
                    style={{ background: c.brandColor }}
                  />
                  <span>{c.brandColor}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add center" size="lg">
        <CenterForm onCancel={() => setAdding(false)} onSuccess={() => setAdding(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.name}` : ""} size="lg">
        {editing && <CenterForm center={editing} onCancel={() => setEditing(null)} onSuccess={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!thresholding} onClose={() => setThresholding(null)} title={thresholding ? `${thresholding.name} — alert thresholds` : ""} size="lg">
        {thresholding && (
          <ThresholdsForm
            centerId={thresholding.id}
            current={thresholding.effective}
            hasOverride={thresholding.hasOverride}
            onCancel={() => setThresholding(null)}
            onSuccess={() => setThresholding(null)}
          />
        )}
      </Modal>
    </>
  );
}

function ThresholdSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

