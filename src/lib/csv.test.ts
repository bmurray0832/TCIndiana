import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("emits a header row from the first row's keys", () => {
    const csv = toCsv([{ name: "Jane", amount: 50 }]);
    expect(csv).toBe("name,amount\r\nJane,50");
  });

  it("quotes commas, quotes, and newlines", () => {
    const csv = toCsv([{ note: 'said "hi", then left', n: 1 }]);
    expect(csv).toContain('"said ""hi"", then left"');
  });

  it("renders null/undefined as empty cells", () => {
    const csv = toCsv([{ a: null, b: undefined, c: "x" }]);
    expect(csv.split("\r\n")[1]).toBe(",,x");
  });

  it("returns empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
