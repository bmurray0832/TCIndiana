"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Field, TextInput, Textarea, Select, Checkbox } from "@/components/forms/FormFields";
import { cn } from "@/lib/utils";

const PRESETS = [25, 50, 100, 250, 500, 1000];

type Frequency = "ONE_TIME" | "MONTHLY";

export function DonationForm({
  centerSlug,
  centerName,
  campaigns,
}: {
  centerSlug: string;
  centerName: string;
  campaigns: { id: string; name: string }[];
}) {
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [frequency, setFrequency] = useState<Frequency>("ONE_TIME");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onPreset(v: number) {
    setAmount(v);
    setCustomAmount("");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const finalAmount = customAmount ? Number(customAmount) : amount;
    if (!Number.isFinite(finalAmount) || finalAmount < 1) {
      setError("Enter an amount of at least $1.");
      return;
    }
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("amount", String(finalAmount));
    fd.set("frequency", frequency);
    fd.set("centerSlug", centerSlug);

    const res = await fetch("/api/give/checkout", { method: "POST", body: fd });
    if (!res.ok) {
      const text = await res.text();
      setError(text || "Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    const { url } = await res.json();
    if (url) window.location.href = url;
    else {
      setError("Stripe didn't return a checkout URL.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Choose an amount
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRESETS.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => onPreset(v)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                !customAmount && amount === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              ${v}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Other amount ($)" htmlFor="customAmount">
            <TextInput
              id="customAmount"
              type="number"
              min={1}
              step={1}
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Frequency
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["ONE_TIME", "MONTHLY"] as Frequency[]).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setFrequency(f)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium",
                frequency === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {f === "ONE_TIME" ? "One-time" : "Every month"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required>
          <TextInput id="firstName" name="firstName" required />
        </Field>
        <Field label="Last name" htmlFor="lastName" required>
          <TextInput id="lastName" name="lastName" required />
        </Field>
      </div>

      <Field label="Email" htmlFor="email" required hint="We'll send your receipt here.">
        <TextInput id="email" name="email" type="email" required />
      </Field>

      <Field label="Fund" htmlFor="campaignId" hint="Where would you like your gift directed?">
        <Select id="campaignId" name="campaignId" defaultValue="">
          <option value="">General fund (unrestricted)</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>

      <Field label="Tribute (optional)" htmlFor="tribute" hint='e.g. "In honor of Pastor Mike"'>
        <Textarea id="tribute" name="tribute" rows={2} />
      </Field>

      <Checkbox
        name="coverFees"
        label={`Cover the processing fee so 100% of my gift reaches ${centerName}`}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Heart className="h-4 w-4" />
        {pending ? "Redirecting to checkout…" : "Continue to secure checkout"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Payment is processed securely by Stripe. Cards, Apple Pay, Google Pay, and ACH accepted.
      </p>
    </form>
  );
}
