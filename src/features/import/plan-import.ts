import { keysAfter, lastKey } from "@/lib/position";
import { normalizeForCompare } from "@/lib/text";
import { placeCategoryKey, type ItineraryItemT } from "@/lib/tripdata/schemas";
import { hotelForNight, isLodgingName, stopLabel, stopsOfDay } from "../itinerary/helpers";
import { isJourneyStop } from "../itinerary/insights";
import type { TripSnapshot } from "../trip-data/types";

// Turns parsed itinerary items into days → stops, matching places by name.
// Pure (no I/O) so it can be unit-tested and previewed before committing.

export type PlannedStop = {
  key: number;
  label: string;
  placeId: string | null; // existing place
  newPlaceKey: string | null; // normalized name of a place to create
  item: ItineraryItemT;
};

export type PlannedDay = {
  dayId: string | null; // null = not in the trip's dates → "not scheduled"
  date: string | null;
  label: string;
  stops: PlannedStop[];
  current: string[]; // labels of the stops the day has now
};

export type NewPlace = { key: string; name: string; category: string; city: string | null; area: string | null };

const ACTIVITY = /^(?:ארוחת|ארוחה|לחזור|חזרה|נסיעה|טיסה|טיסת|רכבת|הליכה|זמן חופשי|מנוחה|קניות אחרונות|lunch|dinner|breakfast|back to|return to|free time|rest|check[- ]?(?:in|out)\b)|→|←|->|\bnear\b|באזור|\bflight\b|airport\s*&/i;

export function planItinerary(snap: TripSnapshot, items: ItineraryItemT[]): { days: PlannedDay[]; newPlaces: NewPlace[] } {
  const places = snap.places.filter((p) => !p.deleted_at);
  const byName = new Map<string, string>();
  for (const p of places) {
    byName.set(normalizeForCompare(p.name), p.id);
    if (p.city) byName.set(normalizeForCompare(`${p.name} ${p.city}`), p.id);
  }
  const newPlaces = new Map<string, NewPlace>();
  const days = new Map<string, PlannedDay>();

  items.forEach((item, key) => {
    const day =
      typeof item.day === "number" ? (snap.days[item.day - 1] ?? null) : (snap.days.find((d) => d.date === item.day) ?? null);
    const dayKey = day?.id ?? "unscheduled";
    if (!days.has(dayKey)) {
      days.set(dayKey, {
        dayId: day?.id ?? null,
        date: day?.date ?? null,
        label: day ? `${day.date}${day.city ? ` · ${day.city}` : ""}` : "",
        stops: [],
        current: day ? stopsOfDay(snap, day.id).map((s) => stopLabel(snap, s)) : [],
      });
    }
    const name = normalizeForCompare(item.place);
    const existing = byName.get(normalizeForCompare(`${item.place} ${item.city ?? ""}`)) ?? byName.get(name) ?? null;
    // Entries without a city or area ("ארוחת צהריים בפושימי") are activities, not places:
    // they stay as free text instead of cluttering the places list (and the geocoder).
    // Chats give every line a city, so also skip things that read like an activity or a journey
    // ("Lunch near Campo...", "Back to Milano", "Frecciarossa Milano → Venezia", "ארוחת ערב באזור").
    const looksLikePlace = Boolean(item.city || item.area) && !ACTIVITY.test(item.place) && !isJourneyStop(item.place);
    let newPlaceKey: string | null = null;
    if (!existing && looksLikePlace) {
      newPlaceKey = name;
      if (!newPlaces.has(name)) {
        newPlaces.set(name, { key: name, name: item.place, category: placeCategoryKey(item.category), city: item.city ?? day?.city ?? null, area: item.area ?? null });
      }
    }
    days.get(dayKey)!.stops.push({ key, label: item.place, placeId: existing, newPlaceKey, item });
  });

  // Within a day: by start time / part of day when given; otherwise keep the chat's order (stable sort).
  const TOD = { morning: 0, noon: 1, evening: 2 } as const;
  const rank = (s: PlannedStop) => (s.item.start ? Number(s.item.start.replace(":", "")) : s.item.time ? [800, 1300, 1900][TOD[s.item.time]] : null);
  for (const d of days.values()) {
    const timed = d.stops.map((s, i) => ({ s, i, r: rank(s) }));
    // Untimed stops keep their position relative to the previous timed one.
    let last = 0;
    for (const x of timed) {
      if (x.r === null) x.r = last;
      else last = x.r;
    }
    d.stops = timed.sort((a, b) => a.r! - b.r! || a.i - b.i).map((x) => x.s);
  }

  const ordered = [...days.values()].sort((a, b) => ((a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1));
  return { days: ordered, newPlaces: [...newPlaces.values()] };
}

/** Builds the commit_import('itinerary') payload for the chosen days. */
export function itineraryPayload(
  snap: TripSnapshot,
  days: PlannedDay[],
  newPlaces: NewPlace[],
  choice: { include: Set<string>; replace: Set<string> },
) {
  const chosen = days.filter((d) => choice.include.has(d.dayId ?? "unscheduled"));
  const used = new Set(chosen.flatMap((d) => d.stops.map((s) => s.newPlaceKey).filter((k): k is string => !!k)));
  const placeRows = newPlaces.filter((p) => used.has(p.key));
  const placeIds = new Map(placeRows.map((p) => [p.key, crypto.randomUUID()]));
  const placePositions = keysAfter(lastKey(snap.places), placeRows.length);

  const places = placeRows.map((p, i) => ({ id: placeIds.get(p.key), name: p.name, category: p.category, city: p.city, area: p.area, position: placePositions[i] }));
  const stops: Record<string, unknown>[] = [];
  for (const d of chosen) {
    const replace = d.dayId !== null && choice.replace.has(d.dayId);
    const after = replace ? null : lastKey(stopsOfDay(snap, d.dayId));
    const positions = keysAfter(after, d.stops.length);
    d.stops.forEach((s, i) => {
      const placeId = s.placeId ?? (s.newPlaceKey ? placeIds.get(s.newPlaceKey) : null) ?? null;
      stops.push({
        day_id: d.dayId,
        place_id: placeId,
        free_text: placeId ? null : s.label,
        time_of_day: s.item.time ?? null,
        start_time: s.item.start ?? null,
        duration_min: s.item.minutes ?? null,
        transport_note: s.item.transport ?? null,
        notes: s.item.optional ? `אופציונלי${s.item.note ? `. ${s.item.note}` : ""}`.slice(0, 2000) : (s.item.note ?? null),
        position: positions[i],
      });
    });
  }
  return {
    payload: { places, stops, replace_day_ids: chosen.filter((d) => d.dayId && choice.replace.has(d.dayId)).map((d) => d.dayId) },
    count: places.length + stops.length,
  };
}

export type LodgingConflict = { date: string; pasted: string; saved: string };

/**
 * Hotels in a pasted plan that differ from the hotel booking saved for that night
 * (feedback 2026-11-20: the chat named hotels the family never booked, and nothing warned).
 * Only checked where a hotel booking exists; with none saved there's nothing to compare.
 */
export function lodgingConflicts(snap: TripSnapshot, days: PlannedDay[]): LodgingConflict[] {
  const out: LodgingConflict[] = [];
  const same = (a: string, b: string) => {
    const x = normalizeForCompare(a);
    const y = normalizeForCompare(b);
    return x === y || x.includes(y) || y.includes(x);
  };
  for (const d of days) {
    if (!d.date) continue;
    const booked = hotelForNight(snap, d.date);
    if (!booked) continue;
    const bookedNames = [booked.title, snap.places.find((p) => p.id === booked.place_id)?.name].filter((n): n is string => !!n);
    for (const s of d.stops) {
      const place = s.placeId ? snap.places.find((p) => p.id === s.placeId) : null;
      const isHotel = placeCategoryKey(s.item.category) === "lodging" || place?.category === "lodging" || (!s.item.category && isLodgingName(s.label));
      if (!isHotel || bookedNames.some((n) => same(n, s.label))) continue;
      out.push({ date: d.date, pasted: s.label, saved: booked.title });
    }
  }
  return out;
}
