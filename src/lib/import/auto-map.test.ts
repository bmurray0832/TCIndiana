import { describe, it, expect } from "vitest";
import { autoMap } from "@/lib/import/auto-map";

describe("autoMap — constituents", () => {
  it("maps a realistic Bloomerang constituents header row", () => {
    const headers = [
      "Account Number",
      "First Name",
      "Last Name",
      "Primary Email",
      "Primary Phone",
      "Status",
      "Date Created",
      "Lifetime Total",
    ];
    const m = autoMap(headers, "constituents");
    expect(m.bloomerangId).toBe("Account Number");
    expect(m.firstName).toBe("First Name");
    expect(m.lastName).toBe("Last Name");
    expect(m.email).toBe("Primary Email");
    expect(m.phone).toBe("Primary Phone");
    expect(m.donorStatus).toBe("Status");
    expect(m.dateAdded).toBe("Date Created");
    expect(m.lifetimeAmount).toBe("Lifetime Total");
  });

  it("leaves unmatched fields null instead of guessing wildly", () => {
    const m = autoMap(["Column A", "Column B"], "constituents");
    expect(m.firstName).toBeNull();
    expect(m.email).toBeNull();
  });

  it("never maps the same header to two fields", () => {
    const headers = ["Email", "First Name", "Last Name"];
    const m = autoMap(headers, "constituents");
    const assigned = Object.values(m).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
  });
});

describe("autoMap — transactions", () => {
  it("keeps Transaction ID and Constituent ID apart (both present in real exports)", () => {
    const headers = ["Transaction ID", "Constituent ID", "Transaction Date", "Amount", "Method", "Fund"];
    const m = autoMap(headers, "transactions");
    expect(m.bloomerangId).toBe("Transaction ID");
    expect(m.constituentBloomerangId).toBe("Constituent ID");
    expect(m.date).toBe("Transaction Date");
    expect(m.amount).toBe("Amount");
    expect(m.paymentMethod).toBe("Method");
    expect(m.campaignName).toBe("Fund");
  });
});

describe("autoMap — interactions", () => {
  it("maps a realistic interactions header row", () => {
    const headers = ["Interaction ID", "Constituent ID", "Date", "Channel", "Purpose", "Notes"];
    const m = autoMap(headers, "interactions");
    expect(m.bloomerangId).toBe("Interaction ID");
    expect(m.constituentBloomerangId).toBe("Constituent ID");
    expect(m.date).toBe("Date");
    expect(m.channel).toBe("Channel");
    expect(m.purpose).toBe("Purpose");
    expect(m.notes).toBe("Notes");
  });
});
