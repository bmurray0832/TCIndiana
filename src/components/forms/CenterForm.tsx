"use client";

import { useActionState, useEffect } from "react";
import { Field, TextInput, SubmitRow } from "@/components/forms/FormFields";
import { createCenter, updateCenter, type CenterFormState } from "@/lib/actions/admin";
import type { Center } from "@/generated/prisma";

export function CenterForm({
  center,
  onCancel,
  onSuccess,
}: {
  center?: Center;
  onCancel: () => void;
  onSuccess?: () => void;
}) {
  const isEdit = !!center;
  const action = isEdit ? updateCenter.bind(null, center.id) : createCenter;
  const [state, formAction, pending] = useActionState<CenterFormState, FormData>(action, null);

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess();
  }, [state, onSuccess]);

  const errs = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={errs.name}>
          <TextInput id="name" name="name" defaultValue={center?.name ?? ""} required />
        </Field>
        <Field label="URL slug" htmlFor="slug" required error={errs.slug} hint="lowercase letters, numbers, dashes">
          <TextInput id="slug" name="slug" defaultValue={center?.slug ?? ""} required />
        </Field>
      </div>

      <Field
        label="Donation page slug"
        htmlFor="donationPageSlug"
        error={errs.donationPageSlug}
        hint="Public donation page lives at /give/[slug]. Defaults to URL slug."
      >
        <TextInput id="donationPageSlug" name="donationPageSlug" defaultValue={center?.donationPageSlug ?? ""} />
      </Field>

      <Field label="Address" htmlFor="address" error={errs.address}>
        <TextInput id="address" name="address" defaultValue={center?.address ?? ""} />
      </Field>

      <Field label="Brand color (hex)" htmlFor="brandColor" error={errs.brandColor} hint="Optional accent for the donation page.">
        <TextInput id="brandColor" name="brandColor" placeholder="#e85a1a" defaultValue={center?.brandColor ?? ""} />
      </Field>

      <SubmitRow
        onCancel={onCancel}
        submitLabel={isEdit ? "Save changes" : "Add center"}
        pending={pending}
        error={state && !state.ok ? state.error : undefined}
      />
    </form>
  );
}
