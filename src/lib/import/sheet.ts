/** Reading a donation spreadsheet: one tab per month, one row per gift,
 *  with the donor's name and address repeated on every row and a totals
 *  row at the bottom of each tab.
 *
 *  This file is the pure half — turning raw cells into gifts and
 *  donors. It touches no database, so it runs in the browser for the
 *  preview and on the server for the import, and is unit-tested.
 *
 *  These exports carry no record IDs, so two things are derived here:
 *   - who a row belongs to (see `donorKey`), and
 *   - a stable key per gift (see `giftKey`) so re-uploading the same
 *     file adds nothing.
 */

export type Cell = string | number | boolean | Date | null | undefined;
export type RawSheet = { sheet: string; data: Cell[][] };

export type SheetGift = {
  sheet: string;
  /** 1-based row in the tab, for error messages. */
  row: number;
  date: string; // YYYY-MM-DD
  name: string;
  amount: number;
  fund: string | null;
  campaign: string | null;
  method: string | null;
  note: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  doNotMail: boolean;
};

export type SheetSummary = {
  sheet: string;
  gifts: number;
  total: number;
  /** The tab's own totals row, when it has one. */
  statedTotal: number | null;
};

export type SheetProblem = { sheet: string; row: number; message: string };

export type ParsedWorkbook = {
  gifts: SheetGift[];
  sheets: SheetSummary[];
  problems: SheetProblem[];
};

const REQUIRED = ["date", "name", "amount"] as const;

/** Header text → field. Matching ignores case, spaces and punctuation. */
const HEADERS: Record<string, keyof SheetGift | "type"> = {
  date: "date",
  name: "name",
  amount: "amount",
  type: "type",
  fund: "fund",
  campaign: "campaign",
  method: "method",
  note: "note",
  primarystreet: "street",
  street: "street",
  address: "street",
  primarycity: "city",
  city: "city",
  primarystate: "state",
  state: "state",
  primaryzipcode: "postalCode",
  zipcode: "postalCode",
  zip: "postalCode",
  primaryemailaddress: "email",
  email: "email",
  primaryphonenumber: "phone",
  phone: "phone",
};

/** Gift types that are money received. A pledge is a promise; its
 *  payments arrive as their own rows. */
const SKIPPED_TYPES = new Set(["pledge", "recurringdonation"]);

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (c: Cell): string | null => {
  if (c === null || c === undefined || c instanceof Date) return null;
  const s = String(c).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};
const isBlank = (c: Cell) => c === null || c === undefined || (typeof c === "string" && c.trim() === "");

/** A cell as a calendar date. Spreadsheet dates have no time zone, so
 *  the day is taken as written. */
export function cellDate(c: Cell): string | null {
  if (c instanceof Date) {
    return isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10);
  }
  if (typeof c === "number" && c > 20000 && c < 80000) {
    // Excel serial day number (days since 1899-12-30).
    return new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86400000).toISOString().slice(0, 10);
  }
  const s = text(c);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const us = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  const [y, m, d] = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : us
      ? [Number(us[3].length === 2 ? `20${us[3]}` : us[3]), Number(us[1]), Number(us[2])]
      : [NaN, NaN, NaN];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(date.getTime()) || date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
}

export function cellAmount(c: Cell): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  const s = text(c);
  if (!s) return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Staff sometimes type an instruction where the street goes. */
const DO_NOT_MAIL = /do\s*not\s*(mail|send)|no\s*mail/i;

export function parseWorkbook(sheets: RawSheet[]): ParsedWorkbook {
  const out: ParsedWorkbook = { gifts: [], sheets: [], problems: [] };

  for (const { sheet, data } of sheets) {
    const headerAt = data.findIndex((r) => r.filter((c) => !isBlank(c)).length >= 3);
    if (headerAt === -1) continue; // empty tab (a month with no gifts yet)

    const cols: Partial<Record<keyof SheetGift | "type", number>> = {};
    data[headerAt].forEach((c, i) => {
      const field = HEADERS[squash(text(c) ?? "")];
      if (field && cols[field] === undefined) cols[field] = i;
    });
    const missing = REQUIRED.filter((f) => cols[f] === undefined);
    if (missing.length) {
      out.problems.push({
        sheet,
        row: headerAt + 1,
        message: `This tab has no ${missing.map((m) => `"${m[0].toUpperCase()}${m.slice(1)}"`).join(" or ")} column, so it was skipped.`,
      });
      continue;
    }

    const get = (r: Cell[], f: keyof SheetGift | "type") => (cols[f] === undefined ? null : r[cols[f]!]);
    const summary: SheetSummary = { sheet, gifts: 0, total: 0, statedTotal: null };

    for (let i = headerAt + 1; i < data.length; i++) {
      const r = data[i];
      if (!r || r.every(isBlank)) continue;
      const row = i + 1;
      const name = text(get(r, "name"));
      const amount = cellAmount(get(r, "amount"));

      // The totals row: an amount and nothing identifying a gift.
      if (!name && isBlank(get(r, "date"))) {
        if (amount !== null) summary.statedTotal = amount;
        continue;
      }
      const date = cellDate(get(r, "date"));
      if (!name || !date || amount === null) {
        const what = !name ? "a donor name" : !date ? "a readable date" : "an amount";
        out.problems.push({ sheet, row, message: `Skipped: this row is missing ${what}.` });
        continue;
      }
      if (amount <= 0) {
        out.problems.push({ sheet, row, message: "Skipped: the amount is zero or negative." });
        continue;
      }
      const type = squash(text(get(r, "type")) ?? "donation");
      if (SKIPPED_TYPES.has(type)) {
        out.problems.push({ sheet, row, message: "Skipped: a pledge or schedule, not money received." });
        continue;
      }

      const rawStreet = text(get(r, "street"));
      const doNotMail = !!rawStreet && DO_NOT_MAIL.test(rawStreet);
      out.gifts.push({
        sheet,
        row,
        date,
        name,
        amount: Math.round(amount * 100) / 100,
        fund: text(get(r, "fund")),
        campaign: text(get(r, "campaign")),
        method: text(get(r, "method")),
        note: text(get(r, "note")),
        email: text(get(r, "email"))?.toLowerCase() ?? null,
        phone: text(get(r, "phone")),
        street: doNotMail ? null : rawStreet,
        city: text(get(r, "city")),
        state: text(get(r, "state")),
        postalCode: text(get(r, "postalCode")),
        doNotMail,
      });
      summary.gifts++;
      summary.total = Math.round((summary.total + amount) * 100) / 100;
    }
    if (summary.gifts > 0 || summary.statedTotal !== null) out.sheets.push(summary);
  }
  return out;
}

/** A name reduced to what should match across rows: case, punctuation
 *  and spacing ignored. */
export const nameKey = (name: string) => squash(name);

/** The first five digits of a ZIP, so "46825" matches "46825-1110". */
export const zip5 = (zip: string | null | undefined) => zip?.match(/\d{5}/)?.[0] ?? null;

const ORG_WORDS =
  /\b(inc|llc|ltd|corp|corporation|company|co|church|chapel|ministr(y|ies)|assembly|fellowship|community|foundation|fund|trust|bank|club|association|society|center|centre|school|university|college|group|partners|services|enterprises|temple|parish|diocese|mission|missions|covenant|baptist|methodist|lutheran|presbyterian|catholic)\b/i;

/** Split one "Name" cell into the first and last name the CRM stores.
 *  - "Ada Lovelace"          → Ada / Lovelace
 *  - "Sam & Pat Rivera"      → Sam & Pat / Rivera
 *  - "Hope Church Fort Wayne" → an organization: the whole name is the
 *    last name (so it sorts by it) and the organization field.
 *  A guess, on purpose — staff can correct any of them on the profile. */
export function splitName(name: string): { firstName: string; lastName: string; organization: string | null } {
  const clean = name.replace(/\s+/g, " ").trim();
  if (ORG_WORDS.test(clean.replace(/[.,]/g, " "))) {
    return { firstName: "", lastName: clean, organization: clean };
  }
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: "", lastName: clean, organization: null };
  // Keep a suffix with the surname: "John Smith Jr." → John / Smith Jr.
  const suffix = /^(jr|sr|ii|iii|iv)\.?$/i.test(parts[parts.length - 1]) && parts.length > 2 ? 2 : 1;
  return {
    firstName: parts.slice(0, -suffix).join(" "),
    lastName: parts.slice(-suffix).join(" "),
    organization: null,
  };
}

/** Gifts grouped by donor. Rows belong to the same donor when they
 *  share an email, or share a name and don't have conflicting ZIPs. */
export type SheetDonor = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  doNotMail: boolean;
  gifts: SheetGift[];
};

export function groupDonors(gifts: SheetGift[]): SheetDonor[] {
  const donors: SheetDonor[] = [];
  const byEmail = new Map<string, SheetDonor>();
  const byName = new Map<string, SheetDonor[]>();

  for (const g of gifts) {
    const nk = nameKey(g.name);
    let donor = g.email ? byEmail.get(g.email) : undefined;
    if (!donor) {
      donor = (byName.get(nk) ?? []).find((d) => {
        const a = zip5(d.postalCode);
        const b = zip5(g.postalCode);
        const emailsDiffer = d.email && g.email && d.email !== g.email;
        return !emailsDiffer && (!a || !b || a === b);
      });
    }
    if (!donor) {
      donor = {
        key: `${nk}|${g.email ?? zip5(g.postalCode) ?? ""}|${donors.length}`,
        name: g.name,
        email: null, phone: null, street: null, city: null, state: null, postalCode: null,
        doNotMail: false,
        gifts: [],
      };
      donors.push(donor);
      byName.set(nk, [...(byName.get(nk) ?? []), donor]);
    }
    // Later rows fill in whatever earlier rows left blank.
    donor.email ??= g.email;
    donor.phone ??= g.phone;
    if (!donor.street && g.street) {
      // Take a street with its own city/state/ZIP so an address is never
      // stitched together from two different rows.
      donor.street = g.street;
      donor.city = g.city ?? donor.city;
      donor.state = g.state ?? donor.state;
      donor.postalCode = g.postalCode ?? donor.postalCode;
    }
    donor.city ??= g.city;
    donor.state ??= g.state;
    donor.postalCode ??= g.postalCode;
    donor.doNotMail ||= g.doNotMail;
    if (donor.email) byEmail.set(donor.email, donor);
    donor.gifts.push(g);
  }
  return donors;
}

/** The parts of a gift that identify it, before hashing. Two identical
 *  gifts on the same day (it happens) are told apart by `nth`, their
 *  order among identical rows. */
export function giftIdentity(centerId: string, gifts: SheetGift[]): string[] {
  const seen = new Map<string, number>();
  return gifts.map((g) => {
    const base = [centerId, g.date, nameKey(g.name), Math.round(g.amount * 100), squash(g.method ?? "")].join("|");
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    return `${base}|${nth}`;
  });
}
