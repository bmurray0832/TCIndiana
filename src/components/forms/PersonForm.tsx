"use client";

import { useActionState, useEffect } from "react";
import { Field, TextInput, Textarea, Select, SubmitRow } from "@/components/forms/FormFields";
import { addPerson, updatePerson, type PersonFormState } from "@/lib/actions/people";
import type { Person } from "@/generated/prisma";

const SOURCES = [
  ["", "—"],
  ["EVENT", "Event"],
  ["REFERRAL", "Referral"],
  ["WALK_IN", "Walk-in"],
  ["ONLINE", "Online"],
  ["SOCIAL_MEDIA", "Social media"],
  ["EMAIL_CAMPAIGN", "Email campaign"],
  ["ANNUAL_GALA", "Annual gala"],
  ["COMMUNITY_EVENT", "Community event"],
  ["OTHER", "Other"],
] as const;

const INTEREST = [
  ["", "—"],
  ["HOT", "Hot"],
  ["WARM", "Warm"],
  ["COLD", "Cold"],
] as const;

const DONOR_STATUS = [
  ["", "—"],
  ["ACTIVE", "Active"],
  ["LAPSED", "Lapsed"],
  ["MAJOR_DONOR", "Major donor"],
] as const;

const GIVING_FREQ = [
  ["", "—"],
  ["ONE_TIME", "One-time"],
  ["MONTHLY", "Monthly"],
  ["QUARTERLY", "Quarterly"],
  ["ANNUAL", "Annual"],
  ["IRREGULAR", "Irregular"],
] as const;

const PREF_CONTACT = [
  ["", "—"],
  ["EMAIL", "Email"],
  ["PHONE", "Phone"],
  ["MAIL", "Mail"],
  ["IN_PERSON", "In-person"],
  ["TEXT", "Text"],
] as const;

type Variant = "prospect" | "donor";

export function PersonForm({
  centers,
  variant,
  person,
  onSuccess,
  onCancel,
}: {
  centers: { id: string; name: string }[];
  variant: Variant;
  person?: Person | null;
  onSuccess?: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!person;
  const action = isEdit ? updatePerson.bind(null, person.id) : addPerson;
  const [state, formAction, pending] = useActionState<PersonFormState, FormData>(action, null);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};
  const isDonorView = variant === "donor" || !!person?.convertedToDonorAt;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={errs.firstName}>
          <TextInput id="firstName" name="firstName" defaultValue={person?.firstName ?? ""} required />
        </Field>
        <Field label="Last name" htmlFor="lastName" required error={errs.lastName}>
          <TextInput id="lastName" name="lastName" defaultValue={person?.lastName ?? ""} required />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email" htmlFor="email" error={errs.email}>
          <TextInput id="email" name="email" type="email" defaultValue={person?.email ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errs.phone}>
          <TextInput id="phone" name="phone" defaultValue={person?.phone ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Center" htmlFor="centerId" required error={errs.centerId}>
          <Select id="centerId" name="centerId" defaultValue={person?.centerId ?? centers[0]?.id ?? ""} required>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Preferred contact" htmlFor="preferredContact" error={errs.preferredContact}>
          <Select id="preferredContact" name="preferredContact" defaultValue={person?.preferredContact ?? ""}>
            {PREF_CONTACT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
      </div>

      {isDonorView ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Donor status" htmlFor="donorStatus" error={errs.donorStatus}>
            <Select id="donorStatus" name="donorStatus" defaultValue={person?.donorStatus ?? ""}>
              {DONOR_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Giving frequency" htmlFor="givingFrequency" error={errs.givingFrequency}>
            <Select id="givingFrequency" name="givingFrequency" defaultValue={person?.givingFrequency ?? ""}>
              {GIVING_FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Source" htmlFor="source" error={errs.source}>
            <Select id="source" name="source" defaultValue={person?.source ?? ""}>
              {SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Interest" htmlFor="interestLevel" error={errs.interestLevel}>
            <Select id="interestLevel" name="interestLevel" defaultValue={person?.interestLevel ?? ""}>
              {INTEREST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
        </div>
      )}

      <Field label="Next step" htmlFor="nextStep" hint="What's the immediate next action?" error={errs.nextStep}>
        <TextInput id="nextStep" name="nextStep" defaultValue={person?.nextStep ?? ""} />
      </Field>

      <Field label="Notes" htmlFor="notes" error={errs.notes}>
        <Textarea id="notes" name="notes" defaultValue={person?.notes ?? ""} />
      </Field>

      <SubmitRow
        onCancel={onCancel}
        submitLabel={isEdit ? "Save changes" : variant === "donor" ? "Add donor" : "Add prospect"}
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
