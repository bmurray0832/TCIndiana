import { PageHeader } from "@/components/PageHeader";
import { UsersList } from "@/components/settings/UsersList";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const me = await getCurrentUser();
  if (!me) return null;
  if (me.orgRole !== "ORG_ADMIN") {
    return <div className="text-sm text-muted-foreground">HQ admins only.</div>;
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
    <>
      <PageHeader
        title="Users"
        subtitle={`${users.length} provisioned · users sign in with the email below via Auth0`}
      />
      <UsersList users={users} centers={centers} meId={me.id} />
    </>
  );
}
