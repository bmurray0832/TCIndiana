"use client";

import { useActionState, useEffect } from "react";
import { Field, TextInput, Textarea, Select, Checkbox, SubmitRow } from "@/components/forms/FormFields";
import { createCampaign, updateCampaign, type CampaignFormState } from "@/lib/actions/admin";
import type { Campaign } from "@/generated/prisma";

export function CampaignForm({
  campaign,
  centers,
  onCancel,
  onSuccess,
}: {
  campaign?: Campaign;
  centers: { id: string; name: string }[];
  onCancel: () => void;
  onSuccess?: () => void;
}) {
  const isEdit = !!campaign;
  const action = isEdit ? updateCampaign.bind(null, campaign.id) : createCampaign;
  const [state, formAction, pending] = useActionState<CampaignFormState, FormData>(action, null);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Name" htmlFor="name" required error={errs.name}>
        <TextInput id="name" name="name" defaultValue={campaign?.name ?? ""} required />
      </Field>

      <Field label="Description" htmlFor="description" error={errs.description}>
        <Textarea id="description" name="description" defaultValue={campaign?.description ?? ""} placeholder="Optional — shows on reports." />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Goal amount ($)" htmlFor="goalAmount" error={errs.goalAmount} hint="Optional — used to show % to goal on the report.">
          <TextInput
            id="goalAmount"
            name="goalAmount"
            type="number"
            min={0}
            step={100}
            defaultValue={campaign?.goalAmount ? String(campaign.goalAmount) : ""}
          />
        </Field>
        <Field label="Center" htmlFor="centerId" error={errs.centerId} hint="Leave blank for org-wide campaigns.">
          <Select id="centerId" name="centerId" defaultValue={campaign?.centerId ?? ""}>
            <option value="">— Org-wide —</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Checkbox name="active" label="Active — show in donation forms and on the giving page" defaultChecked={campaign ? campaign.active : true} />

      <SubmitRow
        onCancel={onCancel}
        submitLabel={isEdit ? "Save changes" : "Add campaign"}
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
