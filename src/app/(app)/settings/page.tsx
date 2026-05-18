import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { currentUserSummary } from "@/lib/queries";
import { DEFAULT_THRESHOLDS, effectiveThresholds } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await currentUserSummary();
  const org = me.user
    ? await prisma.organization.findUnique({ where: { id: me.user.organizationId } })
    : null;
  const centers = me.user
    ? await prisma.center.findMany({
        where: { organizationId: me.user.organizationId },
        orderBy: { name: "asc" },
      })
    : [];

  const orgDefaults = effectiveThresholds(org?.defaultAlertThresholds, null);

  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        subtitle={`Signed in as ${me.user?.name ?? "—"} · ${me.user?.orgRole ?? ""}`}
      />

      <section className="mb-8 rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Organization</h2>
        </header>
        <div className="space-y-2 px-4 py-3 text-sm">
          <Row label="Name" value={org?.name ?? "—"} />
          <Row label="Slug" value={org?.slug ?? "—"} />
          <Row label="Default alert thresholds (days since contact)" value="" />
          <pre className="ml-4 text-xs text-muted-foreground">
            Donors:    yellow {orgDefaults.donor.yellow} · orange {orgDefaults.donor.orange} · red {orgDefaults.donor.red}
            {"\n"}Prospects: yellow {orgDefaults.prospect.yellow} · orange {orgDefaults.prospect.orange} · red {orgDefaults.prospect.red}
          </pre>
        </div>
      </section>

      <section className="mb-8 rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Centers ({centers.length})</h2>
        </header>
        <ul className="divide-y divide-border">
          {centers.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  /{c.slug} · public giving page: /give/{c.donationPageSlug ?? c.slug}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Thresholds:{" "}
                {c.alertThresholds ? "overridden" : "using org defaults"}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-dashed border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Phase 0.5 — Auth</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Currently using a dev shim that signs you in as <code>{process.env.DEV_USER_EMAIL ?? "<first org_admin>"}</code>.
          Replace with Auth0 before any production data goes in.
        </p>
      </section>

      <p className="mt-6 text-xs text-muted-foreground">
        Editing settings is wired up in Phase 1 once writes land. This page is read-only for now.
      </p>

      <div className="hidden">
        {/* Reference: shape of default thresholds when overriding a center: */}
        <pre>{JSON.stringify(DEFAULT_THRESHOLDS, null, 2)}</pre>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
