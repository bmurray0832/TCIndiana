import { describe, expect, it } from "vitest";
import { canAnywhere, canOn, canOrg, centersWhereCan, type RoleCtx } from "./permissions";

const admin: RoleCtx = { orgRole: "ORG_ADMIN", orgCenterIds: ["a", "b"], centerRoles: [] };
const mixed: RoleCtx = {
  orgRole: "STAFF",
  orgCenterIds: ["a", "b", "c"],
  centerRoles: [
    { centerId: "a", role: "DIRECTOR" },
    { centerId: "b", role: "STAFF" },
    { centerId: "c", role: "VIEWER" },
  ],
};
const nobody: RoleCtx = { orgRole: "STAFF", orgCenterIds: ["a"], centerRoles: [] };

describe("canOn", () => {
  it("gives each role exactly its permissions", () => {
    const perms = ["data:read", "data:write", "import:run", "settings:manage"] as const;
    const held = (c: string) => perms.filter((p) => canOn(mixed, c, p));
    expect(held("a")).toEqual(["data:read", "data:write", "import:run", "settings:manage"]);
    expect(held("b")).toEqual(["data:read", "data:write", "import:run"]);
    expect(held("c")).toEqual(["data:read"]);
  });

  it("denies centers the user has no role on, even inside their organization", () => {
    expect(canOn(nobody, "a", "data:read")).toBe(false);
    expect(canOn(mixed, "zzz", "data:read")).toBe(false);
  });

  it("gives HQ admins everything on their own centers and nothing elsewhere", () => {
    expect(canOn(admin, "a", "settings:manage")).toBe(true);
    expect(canOn(admin, "other-org-center", "data:read")).toBe(false);
  });

  it("denies an unrecognized role", () => {
    const odd = { ...nobody, centerRoles: [{ centerId: "a", role: "OWNER" as never }] };
    expect(canOn(odd, "a", "data:read")).toBe(false);
  });
});

describe("centersWhereCan", () => {
  it("narrows by permission", () => {
    expect(centersWhereCan(mixed, "data:read")).toEqual(["a", "b", "c"]);
    expect(centersWhereCan(mixed, "data:write")).toEqual(["a", "b"]);
    expect(centersWhereCan(mixed, "settings:manage")).toEqual(["a"]);
    expect(centersWhereCan(admin, "data:write")).toEqual(["a", "b"]);
  });
});

describe("org permissions", () => {
  it("belong to HQ admins only — a director cannot manage users", () => {
    expect(canOrg(admin, "users:manage")).toBe(true);
    expect(canOrg(mixed, "users:manage")).toBe(false);
    expect(canAnywhere(mixed, "integrations:manage")).toBe(false);
  });

  it("canAnywhere drives navigation", () => {
    expect(canAnywhere(mixed, "import:run")).toBe(true);
    expect(canAnywhere({ ...nobody, centerRoles: [{ centerId: "a", role: "VIEWER" }] }, "import:run")).toBe(false);
  });
});
