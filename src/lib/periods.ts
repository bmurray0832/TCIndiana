/** Period resolution for the YoY report: pick a month, quarter, or
 *  year and compare it against the same period one year earlier. */

export type PeriodKind = "month" | "quarter" | "year";

export type ResolvedPeriod = {
  kind: PeriodKind;
  /** canonical value for the select, e.g. "2026-07", "2026-3", "2026" */
  value: string;
  currStart: Date;
  currEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  currLabel: string;
  prevLabel: string;
  /** filename-safe slug, e.g. "2026-07", "2026-q3", "2026" */
  slug: string;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parsePeriodKind(v: string | undefined): PeriodKind {
  return v === "month" || v === "quarter" ? v : "year";
}

/** now is injectable for tests. */
export function resolvePeriod(kind: PeriodKind, rawValue: string | undefined, now = new Date()): ResolvedPeriod {
  if (kind === "month") {
    const m = rawValue?.match(/^(\d{4})-(\d{1,2})$/);
    const year = m ? Number(m[1]) : now.getFullYear();
    const month = m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? Number(m[2]) - 1 : now.getMonth();
    const label = (y: number) => `${MONTH_NAMES[month]} ${y}`;
    return {
      kind,
      value: `${year}-${String(month + 1).padStart(2, "0")}`,
      currStart: new Date(year, month, 1),
      currEnd: new Date(year, month + 1, 1),
      prevStart: new Date(year - 1, month, 1),
      prevEnd: new Date(year - 1, month + 1, 1),
      currLabel: label(year),
      prevLabel: label(year - 1),
      slug: `${year}-${String(month + 1).padStart(2, "0")}`,
    };
  }

  if (kind === "quarter") {
    const m = rawValue?.match(/^(\d{4})-([1-4])$/);
    const year = m ? Number(m[1]) : now.getFullYear();
    const q = m ? Number(m[2]) : Math.floor(now.getMonth() / 3) + 1;
    const startMonth = (q - 1) * 3;
    const label = (y: number) => `Q${q} ${y}`;
    return {
      kind,
      value: `${year}-${q}`,
      currStart: new Date(year, startMonth, 1),
      currEnd: new Date(year, startMonth + 3, 1),
      prevStart: new Date(year - 1, startMonth, 1),
      prevEnd: new Date(year - 1, startMonth + 3, 1),
      currLabel: label(year),
      prevLabel: label(year - 1),
      slug: `${year}-q${q}`,
    };
  }

  const year = Number(rawValue) || now.getFullYear();
  return {
    kind: "year",
    value: String(year),
    currStart: new Date(year, 0, 1),
    currEnd: new Date(year + 1, 0, 1),
    prevStart: new Date(year - 1, 0, 1),
    prevEnd: new Date(year, 0, 1),
    currLabel: String(year),
    prevLabel: String(year - 1),
    slug: String(year),
  };
}

/** Select options for each period kind, newest first. */
export function periodOptions(kind: PeriodKind, now = new Date()): { value: string; label: string }[] {
  if (kind === "month") {
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      };
    });
  }
  if (kind === "quarter") {
    const currQ = Math.floor(now.getMonth() / 3);
    return Array.from({ length: 8 }, (_, i) => {
      const total = now.getFullYear() * 4 + currQ - i;
      const y = Math.floor(total / 4);
      const q = (total % 4) + 1;
      return { value: `${y}-${q}`, label: `Q${q} ${y}` };
    });
  }
  return Array.from({ length: 6 }, (_, i) => {
    const y = now.getFullYear() - i;
    return { value: String(y), label: String(y) };
  });
}
