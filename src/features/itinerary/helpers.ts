import { HOME_TZ, utcToWallTime } from "@/lib/tz";
import type { Booking, Place, Stop, TripDay, TripSnapshot } from "../trip-data/types";

export const liveStops = (snap: TripSnapshot) => snap.stops.filter((s) => !s.deleted_at);
export const liveBookings = (snap: TripSnapshot) => snap.bookings.filter((b) => !b.deleted_at);

export function stopsOfDay(snap: TripSnapshot, dayId: string | null): Stop[] {
  return liveStops(snap).filter((s) => s.day_id === dayId);
}

export function stopLabel(snap: TripSnapshot, s: Stop): string {
  if (s.place_id) {
    const p = snap.places.find((x) => x.id === s.place_id);
    if (p) return p.name;
  }
  return s.free_text ?? "";
}

/** Local date of a booking's start (or end) in its own zone. */
export function bookingDates(b: Booking): string[] {
  const out: string[] = [];
  if (b.starts_at) out.push(utcToWallTime(b.starts_at, b.starts_tz ?? HOME_TZ).date);
  if (b.ends_at) out.push(utcToWallTime(b.ends_at, b.ends_tz ?? b.starts_tz ?? HOME_TZ).date);
  return out;
}

/** Bookings that start or end on this day (a hotel shows on check-in and check-out). */
export function bookingsOnDay(snap: TripSnapshot, day: TripDay): { booking: Booking; edge: "start" | "end" }[] {
  const out: { booking: Booking; edge: "start" | "end" }[] = [];
  for (const b of liveBookings(snap)) {
    if (b.starts_at && utcToWallTime(b.starts_at, b.starts_tz ?? HOME_TZ).date === day.date) out.push({ booking: b, edge: "start" });
    else if (b.ends_at && utcToWallTime(b.ends_at, b.ends_tz ?? b.starts_tz ?? HOME_TZ).date === day.date) out.push({ booking: b, edge: "end" });
  }
  return out;
}

/** Local check-in / check-out dates of a booking (wall dates in its own zones). */
export function bookingSpan(b: Booking): { start: string | null; end: string | null } {
  return {
    start: b.starts_at ? utcToWallTime(b.starts_at, b.starts_tz ?? HOME_TZ).date : null,
    end: b.ends_at ? utcToWallTime(b.ends_at, b.ends_tz ?? b.starts_tz ?? HOME_TZ).date : null,
  };
}

/** The hotel booking you sleep in on the night of `date` (checked in on or before it, out after it). */
export function hotelForNight(snap: TripSnapshot, date: string): Booking | null {
  for (const b of liveBookings(snap)) {
    if (b.kind !== "hotel") continue;
    const { start, end } = bookingSpan(b);
    if (start && start <= date && (end ? end > date : start === date)) return b;
  }
  return null;
}

/** Travel days and home ("תל אביב / בדרך", "נתב\"ג"): not a destination, no hotel needed. */
export const isTransitCity = (city: string | null) => Boolean(city && /בדרך|טיסה|נתב"?ג|תל[ -]אביב|לוד|ישראל|israel|tel aviv|in transit|flight/i.test(city));

const JOURNEY = /טיסה|טיסת|flight|shinkansen|שינקנסן|frecciarossa|romancecar|רכבת|train|→|←/i;
export const isLodgingName = (name: string) => LODGING_NAME.test(name);
const LODGING_NAME = /hotel|ryokan|hostel|\binn\b|guest ?house|airbnb|apartment|מלון|ריוקן|הוסטל|אכסני|דירה/i;

/** "Suggestion only, if you already have a hotel, swap it": a hotel the chat proposed, not one we booked. */
const SUGGESTED = /הצעה בלבד|רק הצעה|הצעה:|מוצע|suggest(ed|ion)/i;
export const isSuggestedNote = (note: string | null | undefined) => Boolean(note && SUGGESTED.test(note));

type FoundStay = { name: string; place: Place | null; suggested?: boolean };

/**
 * A stop on this day that is where we sleep: a "lodging" place first, else a stop named like a hotel.
 * Dinner at the hotel's restaurant ("Main Dining Room (The Yama Hotel)", a food place) is not where we sleep.
 */
function lodgingStop(snap: TripSnapshot, day: TripDay): FoundStay | null {
  let byCategory: FoundStay | null = null;
  let byName: FoundStay | null = null;
  for (const s of stopsOfDay(snap, day.id).sort((a, b) => (a.position < b.position ? -1 : 1))) {
    const p = s.place_id ? (snap.places.find((x) => x.id === s.place_id && !x.deleted_at) ?? null) : null;
    const name = p?.name ?? s.free_text ?? "";
    const suggested = isSuggestedNote(s.notes) || isSuggestedNote(p?.notes);
    if (p && p.category === "lodging") byCategory = { name, place: p, suggested };
    else if ((!p || p.category === "other") && LODGING_NAME.test(name) && !JOURNEY.test(name)) byName = { name, place: p, suggested };
  }
  return byCategory ?? byName;
}

/** A day with a flight or a train on it. */
export const hasJourney = (snap: TripSnapshot, day: TripDay) => stopsOfDay(snap, day.id).some((s) => JOURNEY.test(stopLabel(snap, s)));

export type Stay = { city: string; days: TripDay[]; nights: TripDay[] };

/**
 * The trip as stays (a run of days in one city) with the nights slept there. A
 * travel day that ends in a new city gives its night to the next stay; the last
 * day of the trip and nights on a plane have no night to fill.
 */
const sameCity = (a: string | null, b: string | null) => Boolean(a && b && a.split("/")[0].trim().toLowerCase() === b.split("/")[0].trim().toLowerCase());

export function stays(snap: TripSnapshot): Stay[] {
  const days = [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const out: Stay[] = [];
  let carried: TripDay | null = null;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const city = dayCity(snap, d);
    const next = days[i + 1];
    if (!city || isTransitCity(city)) {
      carried = null;
      continue;
    }
    let stay = out.at(-1);
    if (!stay || stay.city !== city || stay.days.at(-1) !== days[i - 1]) {
      stay = { city, days: [], nights: carried ? [carried] : [] };
      out.push(stay);
    }
    carried = null;
    stay.days.push(d);
    if (!next || nightOnTheWay(snap, d)) continue;
    const nextCity = dayCity(snap, next);
    // Travelling on to the next city that day, unless a hotel here says we arrived (Hakone: train in, Yama Hotel).
    const here = lodgingStop(snap, d);
    // A hotel known to be in the next city (Tokyo day, Shinkansen, Hotel in Kanazawa) means we sleep there.
    const hotelAhead = here?.place?.city ? sameCity(here.place.city, nextCity) && !sameCity(here.place.city, city) : false;
    if (nextCity && nextCity !== city && !isTransitCity(nextCity) && hasJourney(snap, d) && (!here || hotelAhead)) carried = d;
    else stay.nights.push(d);
  }
  return out;
}

/** A night spent travelling: a flight or train that day, and the next day is home or "on the way". */
export function nightOnTheWay(snap: TripSnapshot, day: TripDay): boolean {
  const days = [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const next = days[days.findIndex((d) => d.id === day.id) + 1];
  if (!next || !isTransitCity(dayCity(snap, next))) return false;
  return stopsOfDay(snap, day.id).some((s) => JOURNEY.test(stopLabel(snap, s)));
}

/**
 * Where the family sleeps on a day's night, in this order:
 * the lodging chosen on the day; a hotel booking covering the night; a hotel
 * that is a stop in the plan, that day or on an earlier day in the same city
 * (you check in once and sleep there until you move on).
 */
export function nightStay(snap: TripSnapshot, day: TripDay): { name: string; place: Place | null; booking: Booking | null; inferred?: boolean; suggested?: boolean } | null {
  const place = day.lodging_place_id ? (snap.places.find((p) => p.id === day.lodging_place_id && !p.deleted_at) ?? null) : null;
  const booking = hotelForNight(snap, day.date);
  if (place) return { name: place.name, place, booking };
  if (booking) {
    const bp = booking.place_id ? (snap.places.find((p) => p.id === booking.place_id && !p.deleted_at) ?? null) : null;
    return { name: bp?.name ?? booking.title, place: bp, booking };
  }
  const days = [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const city = dayCity(snap, day);
  const at = days.findIndex((d) => d.id === day.id);
  // A travel day (a train or flight on it) ending somewhere new: last night's hotel is behind us.
  const next = days[at + 1];
  const travels = stopsOfDay(snap, day.id).some((s) => JOURNEY.test(stopLabel(snap, s)));
  if (travels && next && dayCity(snap, next) !== city) {
    const here = lodgingStop(snap, day);
    return here ? { ...here, booking: null, inferred: true } : null;
  }
  for (let i = at; i >= 0; i--) {
    const d = days[i];
    if (d.id !== day.id && dayCity(snap, d) !== city) break;
    const stop = lodgingStop(snap, d);
    if (stop) return { ...stop, booking: null, inferred: true };
  }
  return null;
}

/** A night with a place to sleep we chose ourselves (a hotel the chat only suggested still counts as open). */
export const hasStay = (snap: TripSnapshot, day: TripDay) => {
  const stay = nightStay(snap, day);
  return Boolean(stay && !stay.suggested);
};

/** "14:05" in the booking's zone (or home time when asked). */
export function bookingTime(iso: string | null, tz: string | null, homeTime: boolean): string | null {
  if (!iso) return null;
  return utcToWallTime(iso, homeTime ? HOME_TZ : (tz ?? HOME_TZ)).time;
}

export function bookingLocal(b: Booking): string | null {
  if (!b.starts_at) return null;
  const w = utcToWallTime(b.starts_at, b.starts_tz ?? HOME_TZ);
  return `${w.date} ${w.time}`;
}

export function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("he-IL", { weekday: "long", timeZone: "UTC" });
}

export function shortDate(date: string): string {
  return `${Number(date.slice(8))}.${Number(date.slice(5, 7))}`;
}

/** The day's city: set by hand, or else the most common city among its stops' places. */
export function dayCity(snap: TripSnapshot, day: TripDay): string | null {
  if (day.city?.trim()) return day.city.trim();
  const counts = new Map<string, number>();
  for (const s of stopsOfDay(snap, day.id)) {
    const c = s.place_id ? snap.places.find((p) => p.id === s.place_id)?.city?.trim() : null;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [c, n] of counts) if (!best || n > counts.get(best)!) best = c;
  return best;
}

/**
 * Flights grouped into journeys: legs that leave within 30 hours of the previous one
 * (TLV → Abu Dhabi → Tokyo) are one trip there. In time order.
 */
export function flightJourneys(bookings: Booking[]): Booking[][] {
  const legs = bookings.filter((b) => !b.deleted_at && b.kind === "flight" && b.starts_at).sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : 1));
  const out: Booking[][] = [];
  for (const leg of legs) {
    const last = out.at(-1)?.at(-1);
    const from = last ? Date.parse(last.ends_at ?? last.starts_at!) : null;
    if (last && from !== null && Date.parse(leg.starts_at!) - from < 30 * 3_600_000) out.at(-1)!.push(leg);
    else out.push([leg]);
  }
  return out;
}

/** Bookings whose free cancellation ends within `daysAhead` days of today (today included). */
export function cancelDeadlines(bookings: Booking[], today: string, daysAhead = 3): Booking[] {
  return bookings
    .filter((b) => !b.deleted_at && b.cancel_by && b.cancel_by >= today && Date.parse(b.cancel_by) - Date.parse(today) <= daysAhead * 86_400_000)
    .sort((a, b) => (a.cancel_by! < b.cancel_by! ? -1 : 1));
}
