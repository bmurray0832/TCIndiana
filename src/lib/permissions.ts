/** Who may do what, in one place.
 *
 *  Same model as the Holy Insights campus permissions: a user holds a
 *  role per center, each role is a fixed list of permissions, and every
 *  check asks "does this user hold permission P on center C?". HQ
 *  admins hold every permission on every center in their organization,
 *  plus the org-level permissions no center role can grant.
 *
 *  Pure functions over a small context object — no database, no
 *  cookies — so the whole matrix is unit-tested. lib/auth.ts builds the
 *  context once per request and wraps these for server code; the same
 *  functions drive what the UI shows.
 */

export type CenterRole = "DIRECTOR" | "STAFF" | "VIEWER";
export type OrgRole = "ORG_ADMIN" | "STAFF";

/** Held per center. */
export type CenterPermission =
  | "data:read" // see people, contacts, gifts and reports for the center
  | "data:write" // add and edit people, contacts and gifts; send email
  | "import:run" // bulk-load Bloomerang CSV files into the center
  | "settings:manage"; // edit the center's details and alert thresholds

/** Held across the organization; HQ admins only. */
export type OrgPermission =
  | "users:manage"
  | "centers:manage" // create centers
  | "campaigns:manage"
  | "integrations:manage"; // Bloomerang sync and its center mapping

export type Permission = CenterPermission | OrgPermission;

export const ROLE_PERMISSIONS: Record<CenterRole, readonly CenterPermission[]> = {
  VIEWER: ["data:read"],
  STAFF: ["data:read", "data:write", "import:run"],
  DIRECTOR: ["data:read", "data:write", "import:run", "settings:manage"],
};

const ORG_PERMISSIONS: readonly Permission[] = [
  "users:manage",
  "centers:manage",
  "campaigns:manage",
  "integrations:manage",
];

export const ROLE_LABELS: Record<CenterRole, string> = {
  DIRECTOR: "Director",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

export type RoleCtx = {
  orgRole: OrgRole;
  /** Every center in the user's organization. Only consulted for HQ
   *  admins, so a center id from another organization is never granted. */
  orgCenterIds: readonly string[];
  centerRoles: readonly { centerId: string; role: CenterRole }[];
};

export function isOrgPermission(p: Permission): p is OrgPermission {
  return ORG_PERMISSIONS.includes(p);
}

/** Org-level check: no center involved. */
export function canOrg(ctx: RoleCtx, permission: OrgPermission): boolean {
  void permission; // every org permission is HQ-admin-only today
  return ctx.orgRole === "ORG_ADMIN";
}

/** Does the user hold `permission` on this center? Unknown center or
 *  unknown role: no. */
export function canOn(ctx: RoleCtx, centerId: string, permission: CenterPermission): boolean {
  if (ctx.orgRole === "ORG_ADMIN") return ctx.orgCenterIds.includes(centerId);
  const role = ctx.centerRoles.find((r) => r.centerId === centerId)?.role;
  return !!role && (ROLE_PERMISSIONS[role]?.includes(permission) ?? false);
}

/** The centers where the user holds `permission` — use it to narrow
 *  queries and to build pickers. */
export function centersWhereCan(ctx: RoleCtx, permission: CenterPermission): string[] {
  if (ctx.orgRole === "ORG_ADMIN") return [...ctx.orgCenterIds];
  return ctx.centerRoles
    .filter((r) => ROLE_PERMISSIONS[r.role]?.includes(permission))
    .map((r) => r.centerId);
}

/** Holds the permission somewhere. For showing navigation only — a
 *  write must still be checked against its own center with canOn. */
export function canAnywhere(ctx: RoleCtx, permission: Permission): boolean {
  return isOrgPermission(permission)
    ? canOrg(ctx, permission)
    : centersWhereCan(ctx, permission).length > 0;
}
