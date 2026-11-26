import { describe, expect, it } from "vitest";
import { cellAmount, cellDate, giftIdentity, groupDonors, parseWorkbook, splitName, zip5, type Cell } from "./sheet";

const HEADER = ["Date", "Name", "Amount", "Type", "Fund", "Primary Street", "Primary City", "Primary State", "Primary ZIP Code", "Primary Email Address", "Primary Phone Number", "Campaign", "Method", "Note"];
const row = (date: Cell, name: Cell, amount: Cell, extra: Partial<Record<string, Cell>> = {}): Cell[] =>
  HEADER.map((h) => (h === "Date" ? date : h === "Name" ? name : h === "Amount" ? amount : (extra[h] ?? (h === "Type" ? "Donation" : null))));

describe("cells", () => {
  it("reads dates as written, whatever form they arrive in", () => {
    expect(cellDate(new Date("2026-01-30T00:00:00Z"))).toBe("2026-01-30");
    expect(cellDate("2026-03-05")).toBe("2026-03-05");
    expect(cellDate("3/5/2026")).toBe("2026-03-05");
    expect(cellDate("3/5/26")).toBe("2026-03-05");
    expect(cellDate(46052)).toBe("2026-01-30"); // Excel serial
    expect(cellDate("2/30/2026")).toBeNull();
    expect(cellDate("soon")).toBeNull();
  });

  it("reads amounts with or without currency formatting", () => {
    expect(cellAmount(25)).toBe(25);
    expect(cellAmount("$1,250.50")).toBe(1250.5);
    expect(cellAmount("n/a")).toBeNull();
  });
});

describe("parseWorkbook", () => {
  const jan = [
    HEADER,
    row(new Date("2026-01-05T00:00:00Z"), "Ada Lovelace", 100, { "Primary Email Address": "Ada@Example.org", Method: "Check", Fund: "Fort Wayne" }),
    row(new Date("2026-01-09T00:00:00Z"), "Hope Church", 50, { "Primary Street": "DO NOT MAIL RECEIPTS", Method: "Credit Card" }),
    row(null, null, 150), // totals row
  ];

  it("reads gifts, skips empty tabs, and keeps the tab's own total for checking", () => {
    const wb = parseWorkbook([{ sheet: "Jan", data: jan }, { sheet: "Feb", data: [] }, { sheet: "Mar", data: [[null, null]] }]);
    expect(wb.sheets).toEqual([{ sheet: "Jan", gifts: 2, total: 150, statedTotal: 150 }]);
    expect(wb.problems).toEqual([]);
    expect(wb.gifts[0]).toMatchObject({ sheet: "Jan", row: 2, date: "2026-01-05", name: "Ada Lovelace", amount: 100, email: "ada@example.org", method: "Check", fund: "Fort Wayne" });
  });

  it("turns a do-not-mail instruction in the street column into a flag, not an address", () => {
    const [, church] = parseWorkbook([{ sheet: "Jan", data: jan }]).gifts;
    expect(church).toMatchObject({ street: null, doNotMail: true });
  });

  it("reports rows it cannot use instead of guessing", () => {
    const wb = parseWorkbook([
      {
        sheet: "Apr",
        data: [
          HEADER,
          row("not a date", "Ada Lovelace", 10),
          row(new Date("2026-04-01T00:00:00Z"), "Ada Lovelace", "ten"),
          row(new Date("2026-04-01T00:00:00Z"), null, 10),
          row(new Date("2026-04-02T00:00:00Z"), "Ada Lovelace", -5),
          row(new Date("2026-04-03T00:00:00Z"), "Ada Lovelace", 500, { Type: "Pledge" }),
          row(new Date("2026-04-04T00:00:00Z"), "Ada Lovelace", 20),
        ],
      },
    ]);
    expect(wb.gifts.map((g) => g.amount)).toEqual([20]);
    expect(wb.problems.map((p) => p.row)).toEqual([2, 3, 4, 5, 6]);
  });

  it("skips a tab that lacks a required column", () => {
    const wb = parseWorkbook([{ sheet: "Notes", data: [["Who", "What", "When"], ["a", "b", "c"]] }]);
    expect(wb.gifts).toEqual([]);
    expect(wb.problems[0].message).toMatch(/no "Date" or "Name" or "Amount" column/);
  });
});

describe("splitName", () => {
  it("splits people, couples and suffixes", () => {
    expect(splitName("Ada Lovelace")).toEqual({ firstName: "Ada", lastName: "Lovelace", organization: null });
    expect(splitName("Sam & Pat Rivera")).toEqual({ firstName: "Sam & Pat", lastName: "Rivera", organization: null });
    expect(splitName("J.M. & L.A. Hadley")).toMatchObject({ firstName: "J.M. & L.A.", lastName: "Hadley" });
    expect(splitName("John Smith Jr.")).toMatchObject({ firstName: "John", lastName: "Smith Jr." });
  });

  it("keeps organizations whole", () => {
    for (const org of ["Hope Church Fort Wayne", "Grace Summit, Inc.", "First Assembly of God", "New Wine Covenant Community"]) {
      expect(splitName(org)).toEqual({ firstName: "", lastName: org, organization: org });
    }
  });
});

describe("groupDonors", () => {
  const gift = (name: string, extra: object = {}) => ({
    sheet: "Jan", row: 2, date: "2026-01-05", name, amount: 10, fund: null, campaign: null, method: null, note: null,
    email: null, phone: null, street: null, city: null, state: null, postalCode: null, doNotMail: false, ...extra,
  });

  it("groups by email, then by name, filling blanks from later rows", () => {
    const donors = groupDonors([
      gift("Ada Lovelace"),
      gift("ADA  LOVELACE", { email: "ada@example.org", street: "1 Main St", city: "Leo", state: "IN", postalCode: "46765-9661" }),
      gift("A. Lovelace", { email: "ada@example.org" }),
    ]);
    expect(donors).toHaveLength(1);
    expect(donors[0]).toMatchObject({ email: "ada@example.org", street: "1 Main St", postalCode: "46765-9661" });
    expect(donors[0].gifts).toHaveLength(3);
  });

  it("keeps two people with the same name apart when their ZIPs or emails differ", () => {
    expect(groupDonors([gift("John Smith", { postalCode: "46825" }), gift("John Smith", { postalCode: "46774-2037" })])).toHaveLength(2);
    expect(groupDonors([gift("John Smith", { email: "a@x.org" }), gift("John Smith", { email: "b@x.org" })])).toHaveLength(2);
    expect(groupDonors([gift("John Smith", { postalCode: "46825" }), gift("John Smith", { postalCode: "46825-1110" })])).toHaveLength(1);
  });

  it("carries a do-not-mail flag from any row", () => {
    expect(groupDonors([gift("Hope Church"), gift("Hope Church", { doNotMail: true })])[0].doNotMail).toBe(true);
  });
});

describe("giftIdentity", () => {
  const g = (amount: number, method = "Check") => ({
    sheet: "Jan", row: 2, date: "2026-01-05", name: "Ada Lovelace", amount, fund: null, campaign: null, method, note: null,
    email: null, phone: null, street: null, city: null, state: null, postalCode: null, doNotMail: false,
  });

  it("is stable across uploads and tells identical same-day gifts apart", () => {
    const first = giftIdentity("c1", [g(10), g(10), g(25)]);
    expect(first).toEqual(giftIdentity("c1", [g(10), g(10), g(25)]));
    expect(new Set(first).size).toBe(3);
  });

  it("differs by center, so the same file can be loaded for two centers", () => {
    expect(giftIdentity("c1", [g(10)])).not.toEqual(giftIdentity("c2", [g(10)]));
  });

  it("ignores name spacing and case", () => {
    expect(giftIdentity("c1", [{ ...g(10), name: "ada  LOVELACE" }])).toEqual(giftIdentity("c1", [g(10)]));
  });
});

describe("zip5", () => {
  it("takes the first five digits", () => {
    expect(zip5("46825-1110")).toBe("46825");
    expect(zip5(null)).toBeNull();
  });
});
