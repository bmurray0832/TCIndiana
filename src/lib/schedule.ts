/** Pure timetable maths for the in-app scheduler: given the current
 *  instant, which run of a job (if any) is due? Kept free of I/O so the
 *  daylight-saving and catch-up behaviour is unit-tested.
 *
 *  Times are wall-clock times in the organization's time zone, so
 *  "Monday 9 AM" stays Monday 9 AM across daylight-saving changes. */

export type Schedule = {
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday. Omit for every day. */
  weekday?: number;
  /** Day of the month. Omit for every day. */
  dayOfMonth?: number;
};

/** How long after its scheduled time a run may still start. Covers a
 *  deploy or outage at the scheduled minute without ever running a job
 *  a day late. */
export const GRACE_MINUTES = 6 * 60;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localParts(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfMonth: Number(parts.day),
    weekday: WEEKDAYS.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** The slot (local date) of the run that is due right now, or null.
 *  A slot is claimed at most once, so calling this every minute is safe. */
export function dueSlot(schedule: Schedule, now: Date, timeZone: string): string | null {
  const local = localParts(now, timeZone);
  if (schedule.weekday !== undefined && schedule.weekday !== local.weekday) return null;
  if (schedule.dayOfMonth !== undefined && schedule.dayOfMonth !== local.dayOfMonth) return null;
  const late = local.minutes - (schedule.hour * 60 + schedule.minute);
  return late >= 0 && late < GRACE_MINUTES ? local.date : null;
}
