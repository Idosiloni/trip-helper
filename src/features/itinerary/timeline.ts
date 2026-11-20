import { HOME_TZ, utcToWallTime } from "@/lib/tz";
import type { Booking, Stop } from "../trip-data/types";

// One day as a timeline: stops in the family's order, bookings slotted in at
// their local time, and section headers (morning / noon / evening) where the
// part of day changes. Pure, so it's easy to test.

export type Section = "morning" | "noon" | "evening";
export type TimelineItem =
  | { type: "section"; section: Section }
  | { type: "stop"; stop: Stop; minute: number | null; index: number }
  | { type: "booking"; booking: Booking; edge: "start" | "end"; time: string | null; minute: number };

const SECTION_START: Record<Section, number> = { morning: 9 * 60, noon: 13 * 60, evening: 18 * 60 };

export function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function sectionOf(minute: number): Section {
  return minute < 12 * 60 ? "morning" : minute < 17 * 60 ? "noon" : "evening";
}

/** A stop's own time: its start time, else the start of its part of day. */
export function stopMinute(s: Pick<Stop, "start_time" | "time_of_day">): number | null {
  return toMinutes(s.start_time) ?? (s.time_of_day ? SECTION_START[s.time_of_day] : null);
}

export function bookingWall(b: Booking, edge: "start" | "end") {
  const iso = edge === "start" ? b.starts_at : b.ends_at;
  if (!iso) return null;
  return utcToWallTime(iso, (edge === "end" ? (b.ends_tz ?? b.starts_tz) : b.starts_tz) ?? HOME_TZ);
}

export function buildTimeline(stops: Stop[], bookings: { booking: Booking; edge: "start" | "end" }[]): TimelineItem[] {
  // Stops without a time borrow the previous one's, so the family's order stands.
  let last: number | null = null;
  const timed = stops.map((stop, index) => {
    const own = stopMinute(stop);
    const minute = own ?? last;
    if (minute !== null) last = minute;
    return { type: "stop" as const, stop, minute: own, sortMinute: minute, index };
  });
  const bk = bookings
    .map(({ booking, edge }) => {
      const w = bookingWall(booking, edge);
      return { type: "booking" as const, booking, edge, time: w?.time ?? null, minute: toMinutes(w?.time) ?? 0 };
    })
    .sort((a, b) => a.minute - b.minute);

  const merged: (Exclude<TimelineItem, { type: "section" }> & { sortMinute?: number | null })[] = [];
  let bi = 0;
  for (const s of timed) {
    while (bi < bk.length && s.sortMinute !== null && bk[bi].minute < s.sortMinute) merged.push(bk[bi++]);
    merged.push(s);
  }
  while (bi < bk.length) merged.push(bk[bi++]);

  // Section headers only when the day has times at all.
  const anyTime = merged.some((x) => (x.type === "stop" ? x.sortMinute !== null : true));
  if (!anyTime) return merged.map(strip);
  const out: TimelineItem[] = [];
  let current: Section | null = null;
  for (const x of merged) {
    const m = x.type === "stop" ? x.sortMinute : x.minute;
    if (m !== null && m !== undefined) {
      const sec = sectionOf(m);
      if (sec !== current) {
        out.push({ type: "section", section: sec });
        current = sec;
      }
    }
    out.push(strip(x));
  }
  return out;
}

function strip<T extends { sortMinute?: unknown }>(x: T): Exclude<TimelineItem, { type: "section" }> {
  const rest = { ...x };
  delete rest.sortMinute;
  return rest as unknown as Exclude<TimelineItem, { type: "section" }>;
}

/**
 * During the day itself: the stop to head to now. The first stop not yet
 * visited whose time (plus its length, or an hour) hasn't passed; stops with
 * no time count as "whenever" and are next only if nothing timed is pending.
 */
export function nextStop(items: TimelineItem[], nowMinute: number, isDone: (s: Stop) => boolean): Stop | null {
  const stops = items.filter((x): x is Extract<TimelineItem, { type: "stop" }> => x.type === "stop");
  let borrowed: number | null = null;
  for (const x of stops) {
    const m = x.minute ?? borrowed;
    if (x.minute !== null) borrowed = x.minute;
    if (isDone(x.stop)) continue;
    if (m === null || m + (x.stop.duration_min ?? 60) >= nowMinute) return x.stop;
  }
  return null;
}

export type DayParts = { morning: Stop[]; noon: Stop[]; evening: Stop[]; anytime: Stop[] };

/** A day's stops split into morning / noon / evening (by time, or borrowed from the stop before). */
export function dayParts(stops: Stop[]): DayParts {
  const out: DayParts = { morning: [], noon: [], evening: [], anytime: [] };
  let current: Section | null = null;
  for (const s of stops) {
    const m = stopMinute(s);
    if (m !== null) current = sectionOf(m);
    if (current) out[current].push(s);
    else out.anytime.push(s);
  }
  return out;
}
