"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Heart, CheckCircle2 } from "lucide-react";
import { Field, TextInput, SubmitRow } from "@/components/forms/FormFields";
import { requestPortalLink, type PortalRequestState } from "@/lib/actions/portal";

export default function PortalRequestPage() {
  const [state, formAction, pending] = useActionState<PortalRequestState, FormData>(requestPortalLink, null);

  return (
    <>
      <header className="mb-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Heart className="h-5 w-5" />
        </div>
        <h1 className="mt-3 text-xl font-bold">TC Indiana giving portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a link to manage your giving.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6">
        {state?.ok ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
            <p className="mt-3 text-sm">
              If we have your email on file, a sign-in link is on its way. Check your inbox in a
              minute or two.
            </p>
            {state.devLink && (
              <div className="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-left text-xs dark:border-yellow-900/40 dark:bg-yellow-950/40">
                <div className="font-medium text-yellow-900 dark:text-yellow-200">
                  Dev mode — Resend not configured
                </div>
                <Link href={state.devLink} className="mt-1 block break-all text-primary hover:underline">
                  {state.devLink}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <Field label="Email" htmlFor="email" required>
              <TextInput id="email" name="email" type="email" required />
            </Field>
            <SubmitRow
              onCancel={() => history.back()}
              submitLabel="Email me a sign-in link"
              pending={pending}
              error={state && !state.ok ? state.error : undefined}
            />
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Just want to give?{" "}
        <Link href="/give" className="text-primary hover:underline">
          Go to the giving page →
        </Link>
      </p>
    </>
  );
}
