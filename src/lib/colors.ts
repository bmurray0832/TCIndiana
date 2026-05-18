/** Alert / status colours. The Green/Yellow/Orange/Red system is the
 *  heartbeat of the app — used on dashboard, lists, and detail pages. */

export const ALERT_HEX = {
  GREEN: "#16a34a",
  YELLOW: "#eab308",
  ORANGE: "#f97316",
  RED: "#ef4444",
} as const;

export const ALERT_TAILWIND = {
  GREEN: {
    bg: "bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    border: "border-green-500/40",
    dot: "bg-green-500",
  },
  YELLOW: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-yellow-500/40",
    dot: "bg-yellow-500",
  },
  ORANGE: {
    bg: "bg-orange-500/10",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-500/40",
    dot: "bg-orange-500",
  },
  RED: {
    bg: "bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-500/40",
    dot: "bg-red-500",
  },
} as const;

export const INTEREST_TAILWIND = {
  HOT: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  WARM: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  COLD: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
} as const;

export const DONOR_STATUS_TAILWIND = {
  ACTIVE: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  LAPSED: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  MAJOR_DONOR: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
} as const;
