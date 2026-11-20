// Calendar helpers. Trip dates are plain calendar dates ("YYYY-MM-DD"), so all
// math here is done on UTC midnights to stay clear of DST and device time zones.

export type TripPhase = "before" | "during" | "after";

export type TripDates = {
  start_date: string | null;
  end_date: string | null;
  phase_override?: TripPhase | null;
};

const DAY_MS = 86_400_000;

function toUtcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Today's calendar date in a given IANA time zone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcDay(toIso) - toUtcDay(fromIso)) / DAY_MS);
}

/** Before / during / after, from the dates; a manual override always wins (SPEC §5). */
export function tripPhase(trip: TripDates, today: string): TripPhase {
  if (trip.phase_override) return trip.phase_override;
  if (!trip.start_date) return "before";
  if (daysBetween(today, trip.start_date) > 0) return "before";
  const end = trip.end_date ?? trip.start_date;
  if (daysBetween(end, today) > 0) return "after";
  return "during";
}

/** 1-based day number within the trip, and its length in days. */
export function tripDay(trip: TripDates, today: string): { day: number; total: number } | null {
  if (!trip.start_date) return null;
  const end = trip.end_date ?? trip.start_date;
  return { day: daysBetween(trip.start_date, today) + 1, total: daysBetween(trip.start_date, end) + 1 };
}

/** Formats a calendar date range for display, e.g. "3–17 בנוב׳ 2027". */
export function formatDateRange(start: string | null, end: string | null, locale = "he-IL"): string {
  if (!start) return "";
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const a = new Date(toUtcDay(start));
  if (!end || end === start) return fmt.format(a);
  return fmt.formatRange(a, new Date(toUtcDay(end)));
}

/** Compact Israeli-style date for tickets and chips, e.g. "1.4.27". */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d}.${m}.${String(y).slice(-2)}`;
}
