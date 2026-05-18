"use client";

import { useActionState, useEffect, useTransition } from "react";
import { Field, TextInput, SubmitRow } from "@/components/forms/FormFields";
import { setCenterThresholds, clearCenterThresholds, type CenterFormState } from "@/lib/actions/admin";
import type { AlertThresholds } from "@/lib/alerts";

export function ThresholdsForm({
  centerId,
  current,
  hasOverride,
  onCancel,
  onSuccess,
}: {
  centerId: string;
  current: AlertThresholds;
  hasOverride: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}) {
  const action = setCenterThresholds.bind(null, centerId);
  const [state, formAction, pending] = useActionState<CenterFormState, FormData>(action, null);
  const [clearing, startClear] = useTransition();

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Days since last contact before each color trips. Donor and prospect rhythms are usually different.
      </p>

      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Donors</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Yellow" htmlFor="donorYellow"><TextInput id="donorYellow" name="donorYellow" type="number" min={1} defaultValue={current.donor.yellow} required /></Field>
          <Field label="Orange" htmlFor="donorOrange"><TextInput id="donorOrange" name="donorOrange" type="number" min={1} defaultValue={current.donor.orange} required /></Field>
          <Field label="Red" htmlFor="donorRed"><TextInput id="donorRed" name="donorRed" type="number" min={1} defaultValue={current.donor.red} required /></Field>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Prospects</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Yellow" htmlFor="prospectYellow"><TextInput id="prospectYellow" name="prospectYellow" type="number" min={1} defaultValue={current.prospect.yellow} required /></Field>
          <Field label="Orange" htmlFor="prospectOrange"><TextInput id="prospectOrange" name="prospectOrange" type="number" min={1} defaultValue={current.prospect.orange} required /></Field>
          <Field label="Red" htmlFor="prospectRed"><TextInput id="prospectRed" name="prospectRed" type="number" min={1} defaultValue={current.prospect.red} required /></Field>
        </div>
      </div>

      {hasOverride && (
        <button
          type="button"
          onClick={() =>
            startClear(async () => {
              await clearCenterThresholds(centerId);
              if (onSuccess) onSuccess();
            })
          }
          disabled={clearing}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          {clearing ? "Reverting…" : "Revert to organization defaults"}
        </button>
      )}

      <SubmitRow
        onCancel={onCancel}
        submitLabel="Save thresholds"
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
