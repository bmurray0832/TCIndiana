import { TARGET_FIELDS, type ImportKindLower, type Mapping } from "@/lib/import/types";

/** Each target field has a list of header phrases we expect Bloomerang to
 *  emit (and common synonyms). The auto-mapper looks for an exact match
 *  first, then a containment match. */
const HINTS: Record<string, string[]> = {
  bloomerangId: ["account number", "constituent id", "constituent number", "constituent account number", "id"],
  firstName: ["first name", "firstname", "first"],
  lastName: ["last name", "lastname", "last", "surname"],
  email: ["primary email", "email", "email address"],
  phone: ["primary phone", "phone", "phone number", "mobile"],
  organization: ["organization", "organization name", "household name"],
  donorStatus: ["status", "constituent status", "donor status", "engagement level"],
  dateAdded: ["date created", "created date", "date added"],
  lastContactAt: ["last engagement", "last interaction", "last contact date"],
  lastGiftDate: ["last gift date", "last transaction date", "last donation"],
  lifetimeAmount: ["lifetime total", "lifetime giving", "total giving", "lifetime amount"],
  notes: ["notes", "tags", "comments", "primary tags"],

  constituentBloomerangId: ["constituent id", "account number", "constituent account number"],
  date: ["transaction date", "date", "gift date", "interaction date"],
  amount: ["amount", "transaction amount", "gift amount"],
  paymentMethod: ["method", "payment method", "payment type"],
  campaignName: ["fund", "campaign", "fund name", "campaign name", "designation"],

  channel: ["channel", "interaction type", "type", "method"],
  purpose: ["purpose", "subject", "interaction purpose", "summary"],
};

function score(header: string, hint: string): number {
  const h = header.toLowerCase().trim();
  const t = hint.toLowerCase().trim();
  if (h === t) return 100;
  if (h.includes(t)) return Math.round((t.length / h.length) * 80);
  if (t.includes(h)) return Math.round((h.length / t.length) * 60);
  return 0;
}

export function autoMap(headers: string[], kind: ImportKindLower): Mapping {
  const fields = TARGET_FIELDS[kind];
  const mapping: Mapping = {};
  const used = new Set<string>();

  for (const field of fields) {
    const hints = HINTS[field.key] ?? [field.label.toLowerCase()];
    let best: { header: string; score: number } | null = null;
    for (const header of headers) {
      if (used.has(header)) continue;
      for (const hint of hints) {
        const s = score(header, hint);
        if (s > 0 && (!best || s > best.score)) best = { header, score: s };
      }
    }
    if (best && best.score >= 50) {
      mapping[field.key] = best.header;
      used.add(best.header);
    } else {
      mapping[field.key] = null;
    }
  }
  return mapping;
}
