"use client";

import { useActionState, useEffect } from "react";
import { Field, TextInput, Textarea, SubmitRow } from "@/components/forms/FormFields";
import { sendEmailToPerson, type SendEmailState } from "@/lib/actions/email";

export function SendEmailForm({
  personId,
  to,
  defaultSubject,
  onSuccess,
}: {
  personId: string;
  to: string;
  defaultSubject?: string;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState<SendEmailState, FormData>(sendEmailToPerson, null);

  useEffect(() => {
    if (state?.ok) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="personId" value={personId} />

      <Field label="To" htmlFor="to">
        <TextInput id="to" value={to} disabled />
      </Field>

      <Field label="Subject" htmlFor="subject" required error={errs.subject}>
        <TextInput id="subject" name="subject" defaultValue={defaultSubject ?? ""} required />
      </Field>

      <Field label="Message" htmlFor="body" required error={errs.body}>
        <Textarea id="body" name="body" rows={10} required placeholder="Plain-text email body — markdown isn't rendered." />
      </Field>

      <p className="text-xs text-muted-foreground">
        Sends from the shared TC Indiana address. Replies route back to{" "}
        <span className="font-medium text-foreground">you</span>. A Contact Log entry is created either way.
      </p>

      <SubmitRow
        onCancel={onSuccess}
        submitLabel="Send email"
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
