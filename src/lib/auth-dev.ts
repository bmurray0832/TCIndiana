import { prisma } from "@/lib/prisma";

/** Dev-only auth shim.
 *
 *  Phase 0.5 will replace this with Auth0. For now, every request acts
 *  as the user whose email matches `DEV_USER_EMAIL` (set in .env). If
 *  unset or unknown, we fall back to the first org_admin in the
 *  database. This keeps the dev experience seamless without paying the
 *  Auth0 setup cost before Phase 1 ships.
 */
export async function getCurrentUser() {
  const email = process.env.DEV_USER_EMAIL;
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { centerRoles: { include: { center: true } } },
    });
    if (user) return user;
  }

  return prisma.user.findFirst({
    where: { orgRole: "ORG_ADMIN" },
    include: { centerRoles: { include: { center: true } } },
  });
}

/** Which centers can the current user see? org_admin → all; everyone
 *  else → only the centers they have a role in. */
export async function getAccessibleCenterIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (user.orgRole === "ORG_ADMIN") {
    const centers = await prisma.center.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true },
    });
    return centers.map((c) => c.id);
  }

  return user.centerRoles.map((r) => r.centerId);
}

/** Throws if the current user can't write to the given center. STAFF
 *  and DIRECTOR can write; VIEWER cannot. ORG_ADMIN can write to any
 *  center in their org. */
export async function requireWriteAccess(centerId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  if (user.orgRole === "ORG_ADMIN") {
    const center = await prisma.center.findUnique({
      where: { id: centerId },
      select: { organizationId: true },
    });
    if (center?.organizationId !== user.organizationId) {
      throw new Error("Center not in your organization");
    }
    return user;
  }

  const role = user.centerRoles.find((r) => r.centerId === centerId);
  if (!role || role.role === "VIEWER") {
    throw new Error("You don't have write access to this center");
  }
  return user;
}
