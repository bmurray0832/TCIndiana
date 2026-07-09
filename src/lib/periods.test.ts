import { describe, it, expect } from "vitest";
import { resolvePeriod, periodOptions, parsePeriodKind } from "@/lib/periods";

const NOW = new Date(2026, 6, 15); // July 15, 2026

describe("parsePeriodKind", () => {
  it("defaults to year for missing or junk values", () => {
    expect(parsePeriodKind(undefined)).toBe("year");
    expect(parsePeriodKind("weekly")).toBe("year");
    expect(parsePeriodKind("month")).toBe("month");
    expect(parsePeriodKind("quarter")).toBe("quarter");
  });
});

describe("resolvePeriod — month", () => {
  it("compares a month against the same month last year", () => {
    const p = resolvePeriod("month", "2026-03", NOW);
    expect(p.currStart).toEqual(new Date(2026, 2, 1));
    expect(p.currEnd).toEqual(new Date(2026, 3, 1));
    expect(p.prevStart).toEqual(new Date(2025, 2, 1));
    expect(p.prevEnd).toEqual(new Date(2025, 3, 1));
    expect(p.currLabel).toBe("Mar 2026");
    expect(p.prevLabel).toBe("Mar 2025");
  });

  it("December rolls into January of the next year for its end bound", () => {
    const p = resolvePeriod("month", "2025-12", NOW);
    expect(p.currEnd).toEqual(new Date(2026, 0, 1));
    expect(p.prevEnd).toEqual(new Date(2025, 0, 1));
  });

  it("defaults to the current month for junk input", () => {
    const p = resolvePeriod("month", "garbage", NOW);
    expect(p.value).toBe("2026-07");
  });
});

describe("resolvePeriod — quarter", () => {
  it("Q4 spans Oct 1 to Jan 1", () => {
    const p = resolvePeriod("quarter", "2025-4", NOW);
    expect(p.currStart).toEqual(new Date(2025, 9, 1));
    expect(p.currEnd).toEqual(new Date(2026, 0, 1));
    expect(p.currLabel).toBe("Q4 2025");
    expect(p.prevLabel).toBe("Q4 2024");
    expect(p.slug).toBe("2025-q4");
  });

  it("defaults to the current quarter", () => {
    const p = resolvePeriod("quarter", undefined, NOW);
    expect(p.value).toBe("2026-3"); // July = Q3
  });
});

describe("resolvePeriod — year", () => {
  it("spans the calendar year", () => {
    const p = resolvePeriod("year", "2025", NOW);
    expect(p.currStart).toEqual(new Date(2025, 0, 1));
    expect(p.currEnd).toEqual(new Date(2026, 0, 1));
    expect(p.prevLabel).toBe("2024");
  });
});

describe("periodOptions", () => {
  it("months: 18 back, newest first", () => {
    const opts = periodOptions("month", NOW);
    expect(opts).toHaveLength(18);
    expect(opts[0]).toEqual({ value: "2026-07", label: "Jul 2026" });
    expect(opts[17]).toEqual({ value: "2025-02", label: "Feb 2025" });
  });

  it("quarters: 8 back, crossing year boundaries correctly", () => {
    const opts = periodOptions("quarter", NOW);
    expect(opts[0]).toEqual({ value: "2026-3", label: "Q3 2026" });
    expect(opts[3]).toEqual({ value: "2025-4", label: "Q4 2025" });
    expect(opts[7]).toEqual({ value: "2024-4", label: "Q4 2024" });
  });

  it("years: 6 back", () => {
    const opts = periodOptions("year", NOW);
    expect(opts[0].value).toBe("2026");
    expect(opts[5].value).toBe("2021");
  });
});
