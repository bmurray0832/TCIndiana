"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { Field, TextInput, Textarea, Select, SubmitRow } from "@/components/forms/FormFields";
import { logContact, type LogContactState } from "@/lib/actions/contacts";

const CONTACT_TYPES = [
  ["PHONE_CALL", "Phone call"],
  ["EMAIL", "Email"],
  ["IN_PERSON_MEETING", "In-person meeting"],
  ["EVENT", "Event"],
  ["MAIL", "Mail"],
  ["TEXT_MESSAGE", "Text message"],
] as const;

const OUTCOMES = [
  ["SCHEDULED_FOLLOW_UP", "Scheduled follow-up"],
  ["NO_ANSWER", "No answer"],
  ["LEFT_MESSAGE", "Left message"],
  ["INFORMATION_SENT", "Information sent"],
  ["NOT_INTERESTED", "Not interested"],
  ["MADE_DONATION", "Made donation"],
  ["OTHER", "Other"],
] as const;

const todayLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function LogContactForm({ personId, onSuccess }: { personId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState<LogContactState, FormData>(logContact, null);

  useEffect(() => {
    if (state?.ok) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="personId" value={personId} />

      <Field label="Date" htmlFor="date" required error={errs.date}>
        <TextInput id="date" name="date" type="date" defaultValue={todayLocal()} required />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type" htmlFor="contactType" required error={errs.contactType}>
          <Select id="contactType" name="contactType" defaultValue="PHONE_CALL" required>
            {CONTACT_TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>

        <Field label="Outcome" htmlFor="outcome" required error={errs.outcome}>
          <Select id="outcome" name="outcome" defaultValue="SCHEDULED_FOLLOW_UP" required>
            {OUTCOMES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" error={errs.notes}>
        <Textarea id="notes" name="notes" placeholder="What happened?" />
      </Field>

      <Field label="Next follow-up date" htmlFor="nextFollowUpAt" hint="Optional — when should we check back in?" error={errs.nextFollowUpAt}>
        <TextInput id="nextFollowUpAt" name="nextFollowUpAt" type="date" />
      </Field>

      <SubmitRow
        onCancel={onSuccess}
        submitLabel="Log contact"
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
