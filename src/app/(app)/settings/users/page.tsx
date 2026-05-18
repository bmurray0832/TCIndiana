import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { UsersList } from "@/components/settings/UsersList";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const me = await getCurrentUser();
  if (!me) return null;
  if (me.orgRole !== "ORG_ADMIN") {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        HQ admins only. <Link href="/settings" className="text-primary hover:underline">Back to settings</Link>
      </div>
    );
  }

  const [users, centers] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: me.organizationId },
      orderBy: [{ orgRole: "asc" }, { name: "asc" }],
      include: {
        centerRoles: { include: { center: { select: { name: true } } } },
      },
    }),
    prisma.center.findMany({
      where: { organizationId: me.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6">
      <Link href="/settings" className="mb-3 inline-block text-xs text-muted-foreground hover:text-primary">
        ← Back to settings
      </Link>
      <PageHeader
        title="Users"
        subtitle={`${users.length} provisioned · users sign in with the email below via Auth0`}
      />
      <UsersList users={users} centers={centers} meId={me.id} />
    </div>
  );
}
