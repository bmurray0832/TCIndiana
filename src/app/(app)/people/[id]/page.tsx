import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertBadge } from "@/components/AlertBadge";
import { getPerson } from "@/lib/queries";
import { formatCurrency, formatDate, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPerson(id);
  if (!p) notFound();

  const isDonor = !!p.convertedToDonorAt;

  return (
    <div className="p-6">
      <Link href={isDonor ? "/donors" : "/prospects"} className="mb-4 inline-block text-xs text-muted-foreground hover:text-primary">
        ← Back to {isDonor ? "donors" : "prospects"}
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(p.firstName, p.lastName)}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {p.firstName} {p.lastName}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{isDonor ? "Donor" : "Prospect"}</span>
              <span>·</span>
              <span>{p.center.name}</span>
              <span>·</span>
              <AlertBadge color={p.alertColor} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <button disabled className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 opacity-60">
            Log Contact (Phase 1)
          </button>
          <button disabled className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 opacity-60">
            Add Donation (Phase 1)
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="space-y-4 lg:col-span-1">
          <Card title="Contact">
            <Field label="Email" value={p.email} />
            <Field label="Phone" value={p.phone} />
            <Field label="Preferred" value={p.preferredContact?.replace("_", "-")} />
          </Card>

          {isDonor ? (
            <Card title="Giving">
              <Field label="Status" value={p.donorStatus?.replace("_", " ")} />
              <Field label="Frequency" value={p.givingFrequency?.replace("_", "-")} />
              <Field label="Lifetime" value={formatCurrency(Number(p.lifetimeAmount))} />
              <Field label="This year" value={formatCurrency(Number(p.ytdAmount))} />
              <Field label="Last year" value={formatCurrency(Number(p.lastYearAmount))} />
              <Field label="Last donation" value={formatDate(p.lastDonationAt)} />
            </Card>
          ) : (
            <Card title="Pipeline">
              <Field label="Interest" value={p.interestLevel} />
              <Field label="Source" value={p.source?.replace("_", " ")} />
              <Field label="Next step" value={p.nextStep} />
              <Field label="Added" value={formatDate(p.dateAdded)} />
            </Card>
          )}

          <Card title="Engagement">
            <Field label="Last contact" value={formatDate(p.lastContactAt)} />
            <Field
              label="Days since"
              value={p.daysSinceContact === null ? "never" : String(p.daysSinceContact)}
            />
          </Card>

          {p.notes && (
            <Card title="Notes">
              <p className="text-sm text-muted-foreground">{p.notes}</p>
            </Card>
          )}
        </aside>

        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Contact history</h2>
              <p className="text-xs text-muted-foreground">{p.contacts.length} entries</p>
            </header>
            <ul className="divide-y divide-border">
              {p.contacts.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">No contact history yet.</li>
              ) : (
                p.contacts.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {c.contactType.replace(/_/g, " ").toLowerCase()}
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {c.outcome.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(c.date)}</div>
                    </div>
                    {c.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
                    {c.staff && <div className="mt-1 text-xs text-muted-foreground">by {c.staff.name}</div>}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Donations</h2>
              <p className="text-xs text-muted-foreground">{p.donations.length} entries</p>
            </header>
            {p.donations.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No donations yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Campaign</th>
                    <th className="px-4 py-2 font-medium">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.donations.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(d.date)}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(Number(d.amount))}
                      </td>
                      <td className="px-4 py-2 text-xs">{d.campaign?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {d.paymentMethod.replace(/_/g, " ").toLowerCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2 px-4 py-3">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
    </div>
  );
}
