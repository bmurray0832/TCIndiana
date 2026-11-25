/** Decide which center a Bloomerang constituent belongs to.
 *
 *  Same approach as the Holy Insights campus mapping: read the campus
 *  name off the incoming record, match it against our center names
 *  forgivingly, let an admin's saved decision override the match, and
 *  fall back to a default when nothing matches. Pure — no database.
 */

import type { ApiConstituent } from "./map";

/** Strip accents so "Español" matches "Espanol". */
const stripDiacritics = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** exact → accent-stripped → letters and digits only */
function keys(raw: string): string[] {
  const exact = raw.toLowerCase().trim();
  const noAccent = stripDiacritics(exact);
  return [exact, noAccent, noAccent.replace(/[^a-z0-9]/g, "")];
}

export type CenterResolver = {
  /** Center id for a field value, or null to use the default center. */
  resolve(raw: string): string | null;
  /** How the value was (or wasn't) resolved, for the settings screen. */
  explain(raw: string): { centerId: string | null; via: "saved" | "name" | "none" };
};

export function buildCenterResolver(
  centers: { id: string; name: string }[],
  saved: { value: string; centerId: string | null }[],
): CenterResolver {
  const byName = new Map<string, string>();
  for (const c of centers) {
    for (const k of keys(c.name)) if (k && !byName.has(k)) byName.set(k, c.id);
  }
  const validIds = new Set(centers.map((c) => c.id));
  const decided = new Map<string, string>();
  for (const s of saved) {
    if (s.centerId && validIds.has(s.centerId)) decided.set(s.value.toLowerCase().trim(), s.centerId);
  }

  function explain(raw: string): ReturnType<CenterResolver["explain"]> {
    const savedId = decided.get(raw.toLowerCase().trim());
    if (savedId) return { centerId: savedId, via: "saved" };
    for (const k of keys(raw)) {
      const id = k ? byName.get(k) : undefined;
      if (id) return { centerId: id, via: "name" };
    }
    return { centerId: null, via: "none" };
  }
  return { explain, resolve: (raw) => explain(raw).centerId };
}

/** The value of the named custom field on a constituent, if set. For a
 *  pick-many field the first value wins. */
export function centerFieldValue(c: ApiConstituent, fieldName: string | null | undefined): string | null {
  const want = fieldName?.toLowerCase().trim();
  if (!want) return null;
  for (const cv of c.CustomValues ?? []) {
    if (cv.FieldText?.toLowerCase().trim() !== want) continue;
    const value = (cv.Value?.Value ?? cv.Values?.[0]?.Value)?.trim();
    if (value) return value;
  }
  return null;
}
