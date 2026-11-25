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
import {
  canOn,
  canOrg,
  centersWhereCan,
  type CenterPermission,
  type OrgPermission,
  type RoleCtx,
} from "@/lib/permissions";

/** The signed-in user plus everything a permission check needs (see
 *  lib/permissions.ts). Built once per request. */
export type SessionUser = RoleCtx & {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  centerRoles: { centerId: string; role: "DIRECTOR" | "STAFF" | "VIEWER" }[];
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  orgRole: "ORG_ADMIN" | "STAFF";
  centerRoles: { centerId: string; role: "DIRECTOR" | "STAFF" | "VIEWER" }[];
};

async function toSessionUser(user: UserRow): Promise<SessionUser> {
  const centers = await prisma.center.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true },
  });
  const orgCenterIds = centers.map((c) => c.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    orgRole: user.orgRole,
    orgCenterIds,
    // A role on a center outside the user's organization grants nothing.
    centerRoles: user.centerRoles
      .filter((r) => orgCenterIds.includes(r.centerId))
      .map((r) => ({ centerId: r.centerId, role: r.role })),
  };
}

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
  return toSessionUser(user);
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
  return toSessionUser(user);
}

/** Centers the user can see. */
export async function getAccessibleCenterIds(): Promise<string[]> {
  const user = await getCurrentUser();
  return user ? centersWhereCan(user, "data:read") : [];
}

/** Centers where the user holds a permission — for narrowing bulk
 *  writes and building pickers. */
export async function getCenterIdsWhereCan(permission: CenterPermission): Promise<string[]> {
  const user = await getCurrentUser();
  return user ? centersWhereCan(user, permission) : [];
}

export type Denied = { ok: false; error: string };

/** The standard gate for server actions. Returns the user, or a form
 *  error to hand straight back to the UI — a viewer pressing Save gets
 *  a message, not a crash page. */
export async function authorize(
  centerId: string,
  permission: CenterPermission,
): Promise<{ ok: true; user: SessionUser } | Denied> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're signed out. Sign in and try again." };
  if (!canOn(user, centerId, permission)) {
    return {
      ok: false,
      error:
        permission === "data:read" || !canOn(user, centerId, "data:read")
          ? "You don't have access to that center."
          : "Your role on this center is view-only.",
    };
  }
  return { ok: true, user };
}

/** Same gate for org-level actions (users, campaigns, integrations). */
export async function authorizeOrg(
  permission: OrgPermission,
): Promise<{ ok: true; user: SessionUser } | Denied> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You're signed out. Sign in and try again." };
  if (!canOrg(user, permission)) return { ok: false, error: "Only HQ admins can do that." };
  return { ok: true, user };
}

/** Throwing form, for code paths with no form to return an error to. */
export async function requireWriteAccess(centerId: string): Promise<SessionUser> {
  const res = await authorize(centerId, "data:write");
  if (!res.ok) throw new Error(res.error);
  return res.user;
}

// Convenience re-export so existing imports continue to work. The
// implementation lives in @/lib/center-scope to avoid pulling the
// cookie API into pure-auth code paths.
export { getActiveCenterIds } from "@/lib/center-scope";
