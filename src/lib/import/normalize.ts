/** Normalizers that turn raw CSV cell values into typed values for
 *  Prisma writes. Used by the import server actions for both dry-run
 *  and commit. */

import type { ContactType, DonorStatus, PaymentMethod } from "@/generated/prisma";

export function trimStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function parseDate(v: unknown): Date | null {
  const s = trimStr(v);
  if (!s) return null;
  // Try several common formats: ISO, US m/d/y, dot-separated, d/m/y.
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, a, b, yRaw] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    const d2 = new Date(Number(y), Number(a) - 1, Number(b));
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

export function parseAmount(v: unknown): number | null {
  const s = trimStr(v);
  if (!s) return null;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function mapDonorStatus(v: unknown): DonorStatus | null {
  const s = trimStr(v)?.toLowerCase();
  if (!s) return null;
  if (s.includes("major")) return "MAJOR_DONOR";
  if (s.includes("lapsed") || s.includes("inactive") || s.includes("dropped")) return "LAPSED";
  if (s.includes("active") || s.includes("current") || s.includes("engaged")) return "ACTIVE";
  return null;
}

export function mapPaymentMethod(v: unknown): PaymentMethod {
  const s = trimStr(v)?.toLowerCase() ?? "";
  if (s.includes("check") || s.includes("cheque")) return "CHECK";
  if (s.includes("cash")) return "CASH";
  if (s.includes("ach") || s.includes("bank") || s.includes("eft") || s.includes("transfer")) return "BANK_TRANSFER";
  if (s.includes("credit") || s.includes("card") || s.includes("debit") || s.includes("visa") || s.includes("mc") || s.includes("amex")) return "CREDIT_CARD";
  if (s.includes("online") || s.includes("paypal") || s.includes("stripe")) return "ONLINE";
  return "CHECK"; // sensible default
}

export function mapContactType(v: unknown): ContactType {
  const s = trimStr(v)?.toLowerCase() ?? "";
  if (s.includes("phone") || s.includes("call")) return "PHONE_CALL";
  if (s.includes("email") || s.includes("e-mail")) return "EMAIL";
  if (s.includes("meeting") || s.includes("visit") || s.includes("in-person") || s.includes("in person")) return "IN_PERSON_MEETING";
  if (s.includes("event") || s.includes("gala")) return "EVENT";
  if (s.includes("mail") || s.includes("letter")) return "MAIL";
  if (s.includes("text") || s.includes("sms")) return "TEXT_MESSAGE";
  return "EMAIL";
}
