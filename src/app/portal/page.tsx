import { redirect } from "next/navigation";
import Link from "next/link";
import { Heart, ExternalLink, LogOut } from "lucide-react";
import { getPortalPerson } from "@/lib/portal-auth";
import { portalSignOut } from "@/lib/actions/portal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const person = await getPortalPerson();
  if (!person) redirect("/portal/request");

  const total = person.donations.reduce((s, d) => s + Number(d.amount), 0);
  const ytd = person.donations
    .filter((d) => new Date(d.date).getFullYear() === new Date().getFullYear())
    .reduce((s, d) => s + Number(d.amount), 0);
  const hasStripeCustomer = !!person.stripeCustomerId && isStripeConfigured();
  const hasSubscription = person.donations.some((d) => d.stripeSubscriptionId);

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Heart className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">TC Indiana</div>
            <div className="text-xs text-muted-foreground">Giving portal</div>
          </div>
        </div>
        <form action={portalSignOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </form>
      </header>

      <section className="mb-6 rounded-lg border border-border bg-card p-5">
        <h1 className="text-xl font-bold">Hi, {person.firstName}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thank you for supporting {person.center.name}. Here&apos;s your giving at a glance.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="This year" value={formatCurrency(ytd)} />
          <Stat label="Lifetime" value={formatCurrency(total)} />
          <Stat label="Gifts" value={person.donations.length} />
        </div>
      </section>

      {hasStripeCustomer && (
        <section className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Payment + subscription</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasSubscription
              ? "Update the card on file, change your monthly amount, or cancel your recurring gift."
              : "Update the payment method we have on file for future gifts."}
          </p>
          <form action="/api/portal/customer-portal" method="POST">
            <button
              type="submit"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open Stripe portal
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Giving history</h2>
          <p className="text-xs text-muted-foreground">{person.donations.length} gifts</p>
        </header>
        {person.donations.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No gifts on record yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Fund</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {person.donations.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(d.date)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(Number(d.amount))}</td>
                  <td className="px-4 py-2 text-xs">{d.campaign?.name ?? "General fund"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {d.paymentMethod.replace(/_/g, " ").toLowerCase()}
                    {d.stripeSubscriptionId && " · recurring"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Need a year-end statement? Email{" "}
        <Link href="mailto:giving@tcindiana.org" className="text-primary hover:underline">
          giving@tcindiana.org
        </Link>
        .
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
