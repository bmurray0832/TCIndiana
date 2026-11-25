/** Pure translation from Bloomerang API objects to the normalized
 *  records lib/import/apply.ts writes. No I/O, so it's unit-tested. */

import type { ContactType, PaymentMethod } from "@/generated/prisma";
import type {
  ConstituentRecord,
  InteractionRecord,
  Invalid,
  TransactionRecord,
} from "@/lib/import/apply";

type AuditTrail = { CreatedDate?: string; LastModifiedDate?: string };

export type ApiConstituent = {
  Id: number;
  Type?: "Individual" | "Organization";
  Status?: "Active" | "Inactive" | "Deceased";
  FirstName?: string | null;
  LastName?: string | null;
  FullName?: string | null;
  Employer?: string | null;
  PrimaryEmail?: { Value?: string | null; IsBad?: boolean } | null;
  PrimaryPhone?: { Number?: string | null; Extension?: string | null } | null;
  CustomValues?: {
    FieldId?: number;
    FieldText?: string;
    Value?: { Id?: number; Value?: string };
    Values?: { Id?: number; Value?: string }[];
  }[];
  AuditTrail?: AuditTrail;
};

export type ApiDesignation = {
  Id: number;
  Type?: string;
  Amount?: number;
  Note?: string | null;
  Fund?: { Name?: string | null } | null;
  Campaign?: { Name?: string | null } | null;
};

export type ApiTransaction = {
  Id: number;
  AccountId: number;
  Date?: string;
  Amount?: number;
  Method?: string;
  IsRefunded?: "Yes" | "No";
  Designations?: ApiDesignation[];
  AuditTrail?: AuditTrail;
};

export type ApiInteraction = {
  Id: number;
  AccountId: number;
  Date?: string;
  Channel?: string;
  Purpose?: string;
  Subject?: string | null;
  Note?: string | null;
  AuditTrail?: AuditTrail;
};

const clean = (v: string | null | undefined) => {
  const s = v?.trim();
  return s ? s : null;
};

/** Bloomerang sends dates as "2024-03-15" or full ISO timestamps. */
export function apiDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function mapConstituent(c: ApiConstituent): ConstituentRecord | Invalid {
  const bloomerangId = String(c.Id);
  const isOrg = c.Type === "Organization";
  const fullName = clean(c.FullName);
  // Organizations have no first/last name: the name goes in lastName so
  // they sort and display sensibly alongside people.
  const firstName = isOrg ? "" : clean(c.FirstName) ?? "";
  const lastName = isOrg ? fullName : clean(c.LastName) ?? (clean(c.FirstName) ? "" : fullName);
  if (lastName === null || (!firstName && !lastName)) return { invalid: "Constituent has no name", bloomerangId };

  const phone = clean(c.PrimaryPhone?.Number);
  const ext = clean(c.PrimaryPhone?.Extension);
  return {
    bloomerangId,
    firstName,
    lastName,
    email: c.PrimaryEmail?.IsBad ? null : clean(c.PrimaryEmail?.Value),
    phone: phone && ext ? `${phone} x${ext}` : phone,
    organization: isOrg ? fullName : clean(c.Employer),
    dateAdded: apiDate(c.AuditTrail?.CreatedDate),
    deceased: c.Status === "Deceased",
  };
}

export function mapMethod(method: string | undefined): PaymentMethod {
  switch (method) {
    case "Cash":
      return "CASH";
    case "CreditCard":
      return "CREDIT_CARD";
    case "Eft":
      return "BANK_TRANSFER";
    case "ApplePay":
    case "GooglePay":
    case "PayPal":
    case "Venmo":
      return "ONLINE";
    default: // Check, InKind, None
      return "CHECK";
  }
}

/** Designation types that are money actually received. "Pledge" and
 *  "RecurringDonation" are promises/schedules — their payments arrive
 *  as separate PledgePayment / RecurringDonationPayment designations,
 *  so counting both would double the gift. */
const RECEIVED = new Set(["Donation", "PledgePayment", "RecurringDonationPayment"]);

/** One Bloomerang transaction can be split across funds. Each received
 *  designation becomes one donation here so campaign totals stay right.
 *  Refunded transactions are returned separately for removal. */
export function mapTransaction(t: ApiTransaction): {
  records: (TransactionRecord | Invalid)[];
  refundedIds: string[];
} {
  const txId = String(t.Id);
  const received = (t.Designations ?? []).filter((d) => RECEIVED.has(d.Type ?? ""));
  const idFor = (d: ApiDesignation) => (received.length === 1 ? txId : `${txId}-${d.Id}`);

  if (t.IsRefunded === "Yes") {
    return { records: [], refundedIds: [txId, ...received.map((d) => `${txId}-${d.Id}`)] };
  }

  const date = apiDate(t.Date);
  const records = received.map((d): TransactionRecord | Invalid => {
    const bloomerangId = idFor(d);
    const amount = typeof d.Amount === "number" ? d.Amount : received.length === 1 ? t.Amount : undefined;
    if (!date || typeof amount !== "number") return { invalid: "Missing date or amount", bloomerangId };
    const note = clean(d.Note);
    return {
      bloomerangId,
      constituentBloomerangId: String(t.AccountId),
      date,
      amount,
      paymentMethod: mapMethod(t.Method),
      campaignName: clean(d.Campaign?.Name) ?? clean(d.Fund?.Name),
      notes: t.Method === "InKind" ? ["In-kind gift", note].filter(Boolean).join(" — ") : note,
    };
  });
  return { records, refundedIds: [] };
}

/** Bulk sends are not a personal touch. Logging them as contacts would
 *  reset every donor's "last contacted" clock each newsletter and hide
 *  the people who actually need a call. */
const BULK_CHANNELS = new Set(["MassEmail", "EngagementSurveyEmail", "EngagementSurveyResponse"]);

export function isPersonalInteraction(i: ApiInteraction): boolean {
  return !BULK_CHANNELS.has(i.Channel ?? "");
}

export function mapChannel(channel: string | undefined): ContactType {
  switch (channel) {
    case "Phone":
      return "PHONE_CALL";
    case "TextMessage":
      return "TEXT_MESSAGE";
    case "Mail":
      return "MAIL";
    case "InPerson":
      return "IN_PERSON_MEETING";
    case "Email":
      return "EMAIL";
    default: // SocialMedia, Website, Twitter, Other
      return "ONLINE";
  }
}

const words = (camel: string) => camel.replace(/([a-z])([A-Z])/g, "$1 $2");

export function mapInteraction(i: ApiInteraction): InteractionRecord | Invalid {
  const bloomerangId = String(i.Id);
  const date = apiDate(i.Date);
  if (!date) return { invalid: "Missing date", bloomerangId };
  const purpose = i.Purpose && i.Purpose !== "Other" ? words(i.Purpose) : null;
  return {
    bloomerangId,
    constituentBloomerangId: String(i.AccountId),
    date,
    contactType: mapChannel(i.Channel),
    notes: [purpose, clean(i.Subject), clean(i.Note)].filter(Boolean).join(" — ") || null,
  };
}
