import type { AlertColor } from "@/generated/prisma";

/** Threshold shape stored on Organization.defaultAlertThresholds and
 *  optionally overridden on Center.alertThresholds. Days since last
 *  contact. */
export type AlertThresholds = {
  donor: { yellow: number; orange: number; red: number };
  prospect: { yellow: number; orange: number; red: number };
};

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  donor: { yellow: 90, orange: 180, red: 365 },
  prospect: { yellow: 14, orange: 30, red: 60 },
};

/** Compute the alert color for a person based on days since last contact.
 *  `isDonor` flips between donor and prospect thresholds. */
export function computeAlertColor(
  daysSinceContact: number | null,
  isDonor: boolean,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): AlertColor {
  // Never been contacted → treat as red so it surfaces.
  if (daysSinceContact === null) return "RED";

  const t = isDonor ? thresholds.donor : thresholds.prospect;
  if (daysSinceContact >= t.red) return "RED";
  if (daysSinceContact >= t.orange) return "ORANGE";
  if (daysSinceContact >= t.yellow) return "YELLOW";
  return "GREEN";
}

/** Resolve effective thresholds for a center: center override > org default. */
export function effectiveThresholds(
  orgDefaults: unknown,
  centerOverride: unknown,
): AlertThresholds {
  const parsed = (centerOverride ?? orgDefaults) as Partial<AlertThresholds> | null;
  if (!parsed || typeof parsed !== "object") return DEFAULT_THRESHOLDS;
  return {
    donor: { ...DEFAULT_THRESHOLDS.donor, ...(parsed.donor ?? {}) },
    prospect: { ...DEFAULT_THRESHOLDS.prospect, ...(parsed.prospect ?? {}) },
  };
}

/** Days since contact for a person row. Returns null if never contacted. */
export function daysSinceContact(lastContactAt: Date | null | undefined): number | null {
  if (!lastContactAt) return null;
  const ms = Date.now() - new Date(lastContactAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
