import Link from "next/link";
import { Users, Building2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { currentUserSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await currentUserSummary();
  const org = me.user
    ? await prisma.organization.findUnique({ where: { id: me.user.organizationId } })
    : null;
  const userCount = me.user
    ? await prisma.user.count({ where: { organizationId: me.user.organizationId } })
    : 0;
  const centerCount = me.user
    ? await prisma.center.count({ where: { organizationId: me.user.organizationId } })
    : 0;

  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        subtitle={`${org?.name ?? ""} · ${me.user?.name ?? "—"} · ${me.user?.orgRole ?? ""}`}
      />

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Tile
          href="/settings/users"
          icon={Users}
          title="Users"
          subtitle={`${userCount} provisioned`}
          description="Add staff, change roles, assign center access."
        />
        <Tile
          href="/settings/centers"
          icon={Building2}
          title="Centers"
          subtitle={`${centerCount} active`}
          description="Add or rename centers, set alert thresholds, brand the donation page."
        />
        <Tile
          href="#"
          icon={ShieldCheck}
          title="Auth (Phase 0.5)"
          subtitle="Active"
          description="Auth0 owns sign-in. User provisioning happens on the Users page."
          disabled
        />
      </section>
    </div>
  );
}

function Tile({
  href,
  icon: Icon,
  title,
  subtitle,
  description,
  disabled,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  description: string;
  disabled?: boolean;
}) {
  const card = (
    <div
      className={`h-full rounded-lg border p-5 ${
        disabled ? "border-dashed border-border bg-card opacity-70" : "border-border bg-card transition-colors hover:border-primary/40"
      }`}
    >
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-2 text-base font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      {!disabled && <p className="mt-3 text-xs font-medium text-primary">Manage →</p>}
    </div>
  );
  return disabled ? card : (
    <Link href={href} className="block">
      {card}
    </Link>
  );
}
