import { describe, it, expect } from "vitest";
import {
  trimStr,
  parseDate,
  parseAmount,
  mapDonorStatus,
  mapPaymentMethod,
  mapContactType,
} from "@/lib/import/normalize";

describe("trimStr", () => {
  it("nulls out empties and trims the rest", () => {
    expect(trimStr("  hi  ")).toBe("hi");
    expect(trimStr("")).toBeNull();
    expect(trimStr("   ")).toBeNull();
    expect(trimStr(null)).toBeNull();
    expect(trimStr(undefined)).toBeNull();
    expect(trimStr(42)).toBe("42");
  });
});

describe("parseDate — Bloomerang exports use several formats", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2024-03-15")?.getFullYear()).toBe(2024);
  });

  it("parses US m/d/y", () => {
    const d = parseDate("3/15/2024");
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(15);
    expect(d?.getFullYear()).toBe(2024);
  });

  it("expands 2-digit years", () => {
    expect(parseDate("3/15/24")?.getFullYear()).toBe(2024);
  });

  it("returns null for blanks and junk", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});

describe("parseAmount — currency strings from CSV cells", () => {
  it("strips $ and thousands separators", () => {
    expect(parseAmount("$1,234.56")).toBe(1234.56);
    expect(parseAmount("500")).toBe(500);
    expect(parseAmount("$50")).toBe(50);
  });

  it("returns null for blanks and junk", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });
});

describe("mapDonorStatus", () => {
  it("maps Bloomerang-style status text", () => {
    expect(mapDonorStatus("Major Donor")).toBe("MAJOR_DONOR");
    expect(mapDonorStatus("lapsed")).toBe("LAPSED");
    expect(mapDonorStatus("Inactive")).toBe("LAPSED");
    expect(mapDonorStatus("Active")).toBe("ACTIVE");
    expect(mapDonorStatus("Engaged")).toBe("ACTIVE");
  });

  it("returns null when unrecognized", () => {
    expect(mapDonorStatus("Board Member")).toBeNull();
    expect(mapDonorStatus("")).toBeNull();
  });
});

describe("mapPaymentMethod", () => {
  it("maps common payment strings", () => {
    expect(mapPaymentMethod("Check")).toBe("CHECK");
    expect(mapPaymentMethod("cash")).toBe("CASH");
    expect(mapPaymentMethod("ACH")).toBe("BANK_TRANSFER");
    expect(mapPaymentMethod("Bank Transfer")).toBe("BANK_TRANSFER");
    expect(mapPaymentMethod("Visa")).toBe("CREDIT_CARD");
    expect(mapPaymentMethod("Credit Card")).toBe("CREDIT_CARD");
    expect(mapPaymentMethod("PayPal")).toBe("ONLINE");
  });

  it("defaults to CHECK for unknown values", () => {
    expect(mapPaymentMethod("")).toBe("CHECK");
    expect(mapPaymentMethod("Barter")).toBe("CHECK");
  });
});

describe("mapContactType", () => {
  it("maps interaction channels", () => {
    expect(mapContactType("Phone Call")).toBe("PHONE_CALL");
    expect(mapContactType("call")).toBe("PHONE_CALL");
    expect(mapContactType("E-mail")).toBe("EMAIL");
    expect(mapContactType("In Person")).toBe("IN_PERSON_MEETING");
    expect(mapContactType("Site Visit")).toBe("IN_PERSON_MEETING");
    expect(mapContactType("Gala")).toBe("EVENT");
    expect(mapContactType("Letter")).toBe("MAIL");
    expect(mapContactType("SMS")).toBe("TEXT_MESSAGE");
  });

  it("defaults to EMAIL for unknown values", () => {
    expect(mapContactType("")).toBe("EMAIL");
    expect(mapContactType("Carrier Pigeon")).toBe("EMAIL");
  });
});
