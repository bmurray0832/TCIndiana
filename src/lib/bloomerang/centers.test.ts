import { describe, expect, it } from "vitest";
import { buildCenterResolver, centerFieldValue } from "./centers";

const centers = [
  { id: "indy", name: "Indianapolis" },
  { id: "fw", name: "Fort Wayne" },
  { id: "sb", name: "South Bend — Español" },
];

describe("buildCenterResolver", () => {
  const r = buildCenterResolver(centers, []);

  it("matches center names forgivingly", () => {
    expect(r.resolve("Fort Wayne")).toBe("fw");
    expect(r.resolve("  fort wayne ")).toBe("fw");
    expect(r.resolve("FortWayne")).toBe("fw");
    expect(r.resolve("Fort-Wayne")).toBe("fw");
    expect(r.resolve("south bend espanol")).toBe("sb");
  });

  it("returns null for an unknown value so the default center is used", () => {
    expect(r.explain("Evansville")).toEqual({ centerId: null, via: "none" });
    expect(r.resolve("")).toBeNull();
  });

  it("lets a saved decision beat the name match", () => {
    const saved = buildCenterResolver(centers, [
      { value: "Fort Wayne", centerId: "indy" },
      { value: "NE Region", centerId: "fw" },
      { value: "Undecided", centerId: null },
    ]);
    expect(saved.explain("fort wayne")).toEqual({ centerId: "indy", via: "saved" });
    expect(saved.resolve("NE Region")).toBe("fw");
    expect(saved.resolve("Undecided")).toBeNull();
  });

  it("ignores a saved decision that points at a center that no longer exists", () => {
    const stale = buildCenterResolver(centers, [{ value: "Fort Wayne", centerId: "deleted" }]);
    expect(stale.explain("Fort Wayne")).toEqual({ centerId: "fw", via: "name" });
  });
});

describe("centerFieldValue", () => {
  const c = {
    Id: 1,
    CustomValues: [
      { FieldId: 1, FieldText: "T-shirt", Value: { Id: 9, Value: "L" } },
      { FieldId: 2, FieldText: "Center", Value: { Id: 3, Value: " Fort Wayne " } },
      { FieldId: 3, FieldText: "Regions", Values: [{ Id: 4, Value: "North" }, { Id: 5, Value: "East" }] },
    ],
  };

  it("finds the field by label, case-insensitively", () => {
    expect(centerFieldValue(c, "center")).toBe("Fort Wayne");
    expect(centerFieldValue(c, "Regions")).toBe("North");
  });

  it("returns null when the field is unset or not configured", () => {
    expect(centerFieldValue(c, "Campus")).toBeNull();
    expect(centerFieldValue(c, null)).toBeNull();
    expect(centerFieldValue({ Id: 2 }, "Center")).toBeNull();
  });
});
