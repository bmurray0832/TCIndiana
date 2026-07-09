import { describe, it, expect } from "vitest";
import {
  computeAlertColor,
  effectiveThresholds,
  daysSinceContact,
  DEFAULT_THRESHOLDS,
} from "@/lib/alerts";

describe("computeAlertColor — donor thresholds (90/180/365)", () => {
  it("is GREEN below yellow", () => {
    expect(computeAlertColor(0, true)).toBe("GREEN");
    expect(computeAlertColor(89, true)).toBe("GREEN");
  });

  it("flips at each boundary (inclusive)", () => {
    expect(computeAlertColor(90, true)).toBe("YELLOW");
    expect(computeAlertColor(179, true)).toBe("YELLOW");
    expect(computeAlertColor(180, true)).toBe("ORANGE");
    expect(computeAlertColor(364, true)).toBe("ORANGE");
    expect(computeAlertColor(365, true)).toBe("RED");
    expect(computeAlertColor(1000, true)).toBe("RED");
  });
});

describe("computeAlertColor — prospect thresholds (14/30/60)", () => {
  it("runs on the faster clock", () => {
    expect(computeAlertColor(13, false)).toBe("GREEN");
    expect(computeAlertColor(14, false)).toBe("YELLOW");
    expect(computeAlertColor(29, false)).toBe("YELLOW");
    expect(computeAlertColor(30, false)).toBe("ORANGE");
    expect(computeAlertColor(59, false)).toBe("ORANGE");
    expect(computeAlertColor(60, false)).toBe("RED");
  });
});

describe("computeAlertColor — special cases", () => {
  it("never contacted surfaces as RED", () => {
    expect(computeAlertColor(null, true)).toBe("RED");
    expect(computeAlertColor(null, false)).toBe("RED");
  });

  it("a future snooze suppresses to GREEN regardless of days", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(computeAlertColor(400, true, DEFAULT_THRESHOLDS, tomorrow)).toBe("GREEN");
    expect(computeAlertColor(null, false, DEFAULT_THRESHOLDS, tomorrow)).toBe("GREEN");
  });

  it("an expired snooze has no effect", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(computeAlertColor(400, true, DEFAULT_THRESHOLDS, yesterday)).toBe("RED");
  });

  it("respects custom thresholds", () => {
    const tight = {
      donor: { yellow: 7, orange: 14, red: 30 },
      prospect: { yellow: 3, orange: 7, red: 14 },
    };
    expect(computeAlertColor(8, true, tight)).toBe("YELLOW");
    expect(computeAlertColor(31, true, tight)).toBe("RED");
    expect(computeAlertColor(4, false, tight)).toBe("YELLOW");
  });
});

describe("effectiveThresholds", () => {
  it("falls back to defaults for null/garbage", () => {
    expect(effectiveThresholds(null, null)).toEqual(DEFAULT_THRESHOLDS);
    expect(effectiveThresholds("nonsense", null)).toEqual(DEFAULT_THRESHOLDS);
  });

  it("center override beats org default", () => {
    const org = { donor: { yellow: 10, orange: 20, red: 30 } };
    const center = { donor: { yellow: 5, orange: 15, red: 25 } };
    expect(effectiveThresholds(org, center).donor).toEqual({ yellow: 5, orange: 15, red: 25 });
  });

  it("partial override merges with defaults per band", () => {
    const partial = { donor: { yellow: 45 } };
    const t = effectiveThresholds(partial, null);
    expect(t.donor).toEqual({ yellow: 45, orange: 180, red: 365 });
    expect(t.prospect).toEqual(DEFAULT_THRESHOLDS.prospect);
  });
});

describe("daysSinceContact", () => {
  it("returns null when never contacted", () => {
    expect(daysSinceContact(null)).toBeNull();
    expect(daysSinceContact(undefined)).toBeNull();
  });

  it("floors to whole days", () => {
    const twoAndAHalfDaysAgo = new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000);
    expect(daysSinceContact(twoAndAHalfDaysAgo)).toBe(2);
  });

  it("is 0 for a contact earlier today", () => {
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(daysSinceContact(anHourAgo)).toBe(0);
  });
});
