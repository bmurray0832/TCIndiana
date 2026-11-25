import { describe, expect, it } from "vitest";
import {
  isPersonalInteraction,
  mapChannel,
  mapConstituent,
  mapInteraction,
  mapMethod,
  mapTransaction,
} from "./map";

describe("mapConstituent", () => {
  it("maps an individual", () => {
    expect(
      mapConstituent({
        Id: 42,
        Type: "Individual",
        Status: "Active",
        FirstName: " Ada ",
        LastName: "Lovelace",
        Employer: "Analytical Engines",
        PrimaryEmail: { Value: "ada@example.org" },
        PrimaryPhone: { Number: "317-555-0100", Extension: "12" },
        AuditTrail: { CreatedDate: "2021-05-01T12:00:00Z" },
      }),
    ).toEqual({
      bloomerangId: "42",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.org",
      phone: "317-555-0100 x12",
      organization: "Analytical Engines",
      dateAdded: new Date("2021-05-01T12:00:00Z"),
      deceased: false,
    });
  });

  it("puts an organization's name in lastName and organization", () => {
    const r = mapConstituent({ Id: 7, Type: "Organization", FullName: "First Church" });
    expect(r).toMatchObject({ firstName: "", lastName: "First Church", organization: "First Church" });
  });

  it("drops emails Bloomerang has marked bad and flags the deceased", () => {
    const r = mapConstituent({
      Id: 1,
      FirstName: "A",
      LastName: "B",
      Status: "Deceased",
      PrimaryEmail: { Value: "x@example.org", IsBad: true },
    });
    expect(r).toMatchObject({ email: null, deceased: true });
  });

  it("rejects a constituent with no name", () => {
    expect(mapConstituent({ Id: 9 })).toEqual({ invalid: "Constituent has no name", bloomerangId: "9" });
  });
});

describe("mapTransaction", () => {
  const base = { Id: 100, AccountId: 42, Date: "2024-03-15", Amount: 150, Method: "Check" };

  it("maps a single-designation gift onto the transaction ID", () => {
    const { records, refundedIds } = mapTransaction({
      ...base,
      Designations: [{ Id: 1, Type: "Donation", Amount: 150, Campaign: { Name: "Gala" }, Fund: { Name: "General" } }],
    });
    expect(refundedIds).toEqual([]);
    expect(records).toEqual([
      {
        bloomerangId: "100",
        constituentBloomerangId: "42",
        date: new Date("2024-03-15"),
        amount: 150,
        paymentMethod: "CHECK",
        campaignName: "Gala",
        notes: null,
      },
    ]);
  });

  it("splits a multi-fund gift and falls back to the fund name", () => {
    const { records } = mapTransaction({
      ...base,
      Designations: [
        { Id: 1, Type: "Donation", Amount: 100, Fund: { Name: "General" } },
        { Id: 2, Type: "Donation", Amount: 50, Campaign: { Name: "Gala" } },
      ],
    });
    expect(records.map((r) => "invalid" in r || [r.bloomerangId, r.amount, r.campaignName])).toEqual([
      ["100-1", 100, "General"],
      ["100-2", 50, "Gala"],
    ]);
  });

  it("counts payments but not the pledge or recurring schedule behind them", () => {
    const types = ["Pledge", "RecurringDonation", "PledgePayment", "RecurringDonationPayment"];
    const counted = types.filter(
      (Type) => mapTransaction({ ...base, Designations: [{ Id: 1, Type, Amount: 150 }] }).records.length === 1,
    );
    expect(counted).toEqual(["PledgePayment", "RecurringDonationPayment"]);
  });

  it("returns refunded gifts for removal instead of import", () => {
    const { records, refundedIds } = mapTransaction({
      ...base,
      IsRefunded: "Yes",
      Designations: [{ Id: 5, Type: "Donation", Amount: 150 }],
    });
    expect(records).toEqual([]);
    expect(refundedIds).toEqual(["100", "100-5"]);
  });

  it("flags a gift with no date", () => {
    const { records } = mapTransaction({ ...base, Date: undefined, Designations: [{ Id: 1, Type: "Donation", Amount: 1 }] });
    expect(records).toEqual([{ invalid: "Missing date or amount", bloomerangId: "100" }]);
  });
});

describe("methods and channels", () => {
  it("maps payment methods", () => {
    expect(["Cash", "Check", "CreditCard", "Eft", "PayPal", "InKind", undefined].map(mapMethod)).toEqual([
      "CASH", "CHECK", "CREDIT_CARD", "BANK_TRANSFER", "ONLINE", "CHECK", "CHECK",
    ]);
  });

  it("maps channels", () => {
    expect(["Phone", "Email", "TextMessage", "Mail", "InPerson", "Website", "Other"].map(mapChannel)).toEqual([
      "PHONE_CALL", "EMAIL", "TEXT_MESSAGE", "MAIL", "IN_PERSON_MEETING", "ONLINE", "ONLINE",
    ]);
  });

  it("treats mass email as not a personal touch", () => {
    expect(isPersonalInteraction({ Id: 1, AccountId: 1, Channel: "MassEmail" })).toBe(false);
    expect(isPersonalInteraction({ Id: 1, AccountId: 1, Channel: "Phone" })).toBe(true);
  });
});

describe("mapInteraction", () => {
  it("joins purpose, subject and note", () => {
    expect(
      mapInteraction({
        Id: 5,
        AccountId: 42,
        Date: "2024-06-01",
        Channel: "Phone",
        Purpose: "ImpactCultivation",
        Subject: "Check-in",
        Note: "Wants a tour",
      }),
    ).toEqual({
      bloomerangId: "5",
      constituentBloomerangId: "42",
      date: new Date("2024-06-01"),
      contactType: "PHONE_CALL",
      notes: "Impact Cultivation — Check-in — Wants a tour",
    });
  });

  it("rejects an interaction with no date", () => {
    expect(mapInteraction({ Id: 5, AccountId: 42 })).toEqual({ invalid: "Missing date", bloomerangId: "5" });
  });
});
