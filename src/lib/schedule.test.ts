import { describe, expect, it } from "vitest";
import { dueSlot, localParts } from "./schedule";

const TZ = "America/Indiana/Indianapolis";
const monday9 = { hour: 9, minute: 0, weekday: 1 };

describe("localParts", () => {
  it("reads the wall clock in the given zone", () => {
    // 2026-11-30 14:30 UTC is Monday 09:30 EST
    expect(localParts(new Date("2026-11-30T14:30:00Z"), TZ)).toEqual({
      date: "2026-11-30",
      dayOfMonth: 30,
      weekday: 1,
      minutes: 9 * 60 + 30,
    });
  });
});

describe("dueSlot", () => {
  it("is not due before the scheduled time", () => {
    expect(dueSlot(monday9, new Date("2026-11-30T13:59:00Z"), TZ)).toBeNull();
  });

  it("is due at the scheduled minute and through the grace window", () => {
    expect(dueSlot(monday9, new Date("2026-11-30T14:00:00Z"), TZ)).toBe("2026-11-30");
    expect(dueSlot(monday9, new Date("2026-11-30T19:59:00Z"), TZ)).toBe("2026-11-30");
  });

  it("gives up after the grace window instead of running late", () => {
    expect(dueSlot(monday9, new Date("2026-11-30T20:00:00Z"), TZ)).toBeNull();
  });

  it("only fires on the right weekday", () => {
    expect(dueSlot(monday9, new Date("2026-12-01T14:00:00Z"), TZ)).toBeNull();
  });

  it("keeps 9 AM local across daylight saving", () => {
    // July: EDT (UTC-4), so 9 AM local is 13:00 UTC, not 14:00.
    expect(dueSlot(monday9, new Date("2026-07-06T12:59:00Z"), TZ)).toBeNull();
    expect(dueSlot(monday9, new Date("2026-07-06T13:00:00Z"), TZ)).toBe("2026-07-06");
  });

  it("handles day-of-month and daily schedules", () => {
    const first10 = { hour: 10, minute: 0, dayOfMonth: 1 };
    expect(dueSlot(first10, new Date("2026-12-01T15:00:00Z"), TZ)).toBe("2026-12-01");
    expect(dueSlot(first10, new Date("2026-12-02T15:00:00Z"), TZ)).toBeNull();
    expect(dueSlot({ hour: 2, minute: 0 }, new Date("2026-12-02T07:05:00Z"), TZ)).toBe("2026-12-02");
  });

  it("uses the local date for the slot, not the UTC date", () => {
    // 23:30 local on the 1st is already the 2nd in UTC.
    expect(dueSlot({ hour: 23, minute: 0 }, new Date("2026-12-02T04:30:00Z"), TZ)).toBe("2026-12-01");
  });
});
