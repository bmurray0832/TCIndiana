"use client";

import { useActionState, useEffect } from "react";
import { Field, TextInput, Textarea, Select, Checkbox, SubmitRow } from "@/components/forms/FormFields";
import { addDonation, type AddDonationState } from "@/lib/actions/donations";

const PAYMENT_METHODS = [
  ["CHECK", "Check"],
  ["CREDIT_CARD", "Credit card"],
  ["CASH", "Cash"],
  ["ONLINE", "Online"],
  ["BANK_TRANSFER", "Bank transfer"],
] as const;

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function AddDonationForm({
  personId,
  campaigns,
  onSuccess,
}: {
  personId: string;
  campaigns: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<AddDonationState, FormData>(addDonation, null);

  useEffect(() => {
    if (state?.ok) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="personId" value={personId} />

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date" htmlFor="date" required error={errs.date}>
          <TextInput id="date" name="date" type="date" defaultValue={todayLocal()} required />
        </Field>
        <Field label="Amount ($)" htmlFor="amount" required error={errs.amount}>
          <TextInput id="amount" name="amount" type="number" inputMode="decimal" min="0" step="0.01" required />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Campaign" htmlFor="campaignId" error={errs.campaignId}>
          <Select id="campaignId" name="campaignId" defaultValue="">
            <option value="">— Unrestricted —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Payment method" htmlFor="paymentMethod" required error={errs.paymentMethod}>
          <Select id="paymentMethod" name="paymentMethod" defaultValue="CHECK" required>
            {PAYMENT_METHODS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={errs.notes}>
        <Textarea id="notes" name="notes" placeholder="Anything noteworthy about this gift?" />
      </Field>

      <div className="flex gap-6">
        <Checkbox name="receiptSent" label="Receipt sent" />
        <Checkbox name="thankYouSent" label="Thank-you sent" />
      </div>

      <SubmitRow
        onCancel={onSuccess}
        submitLabel="Record donation"
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
