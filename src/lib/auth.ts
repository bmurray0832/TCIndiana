/** Authentication layer.
 *
 *  Two paths:
 *  - Auth0 (production + any env where AUTH0_DOMAIN is set). Reads the
 *    SDK session, matches by auth0Sub then email, never auto-creates
 *    Users — provisioning is admin-driven.
 *  - Dev shim (only when Auth0 isn't configured AND NODE_ENV !== "production").
 *    Picks the User whose email matches DEV_USER_EMAIL, or the first
 *    org_admin. Lets the app run without an Auth0 tenant for dev.
 *
 *  Production with Auth0 unset returns null — the app shows a "sign-in
 *  unavailable" screen rather than silently logging anyone in.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getAuth0Client, isAuth0Configured } from "@/lib/auth0";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgRole: "ORG_ADMIN" | "STAFF";
  centerRoles: { centerId: string; role: "DIRECTOR" | "STAFF" | "VIEWER" }[];
};

async function getDevUser(): Promise<SessionUser | null> {
  const email = process.env.DEV_USER_EMAIL;
  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        include: { centerRoles: true },
      })
    : await prisma.user.findFirst({
        where: { orgRole: "ORG_ADMIN" },
        include: { centerRoles: true },
      });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    orgRole: user.orgRole,
    centerRoles: user.centerRoles.map((r) => ({ centerId: r.centerId, role: r.role })),
  };
}

/** Memoized per request: a page render asks for the current user many
 *  times (layout, scope, every query) and each ask used to hit the DB. */
export const getCurrentUser = cache(loadCurrentUser);

async function loadCurrentUser(): Promise<SessionUser | null> {
  if (!isAuth0Configured()) {
    if (process.env.NODE_ENV === "production") return null;
    return getDevUser();
  }

  const auth0 = getAuth0Client();
  if (!auth0) return null;

  const session = await auth0.getSession();
  if (!session?.user) return null;

  const auth0Sub = session.user.sub as string;
  const email = (session.user.email as string) ?? "";

  // First try matching on the Auth0 subject (set after first sign-in).
  let user = await prisma.user.findUnique({
    where: { auth0Sub },
    include: { centerRoles: true },
  });

  // First-time login: match the provisioned User by email and stamp the
  // auth0Sub onto it. We never auto-create users — admins provision
  // them in Settings. Two guards against account takeover:
  //  - the identity provider must vouch for the email (email_verified),
  //  - a User already bound to a different Auth0 identity is never
  //    handed to a second one. An admin must clear the link first.
  if (!user && email && session.user.email_verified === true) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      include: { centerRoles: true },
    });
    if (byEmail && !byEmail.auth0Sub) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { auth0Sub },
        include: { centerRoles: true },
      });
    }
  }

  // Deactivated users keep their row (history) but lose access.
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    orgRole: user.orgRole,
    centerRoles: user.centerRoles.map((r) => ({ centerId: r.centerId, role: r.role })),
  };
}

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

// Convenience re-export so existing imports continue to work. The
// implementation lives in @/lib/center-scope to avoid pulling the
// cookie API into pure-auth code paths.
export { getActiveCenterIds } from "@/lib/center-scope";
