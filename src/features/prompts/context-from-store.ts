import type { PromptContext } from "@/lib/prompts/context";
import { parseTripProfile } from "@/lib/trip-profile";
import type { ImportableKind } from "@/lib/tripdata/schemas";
import { bookingLocal, dayCity, liveBookings, nightStay, stopLabel, stopsOfDay } from "../itinerary/helpers";
import type { TripSnapshot } from "../trip-data/types";
import { weatherText } from "@/lib/weather";
import { knownWeather } from "../weather/useTripWeather";

/** Builds the narrow prompt context from the live trip data (no accounts, emails, ids or booking codes). */
export function promptContext(snap: TripSnapshot, kind: ImportableKind | null, today: string): PromptContext {
  const trip = snap.trip!;
  const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);
  const places = live(snap.places);
  const weather = knownWeather(trip.id);
  return {
    tripName: trip.name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    profile: parseTripProfile(trip.profile),
    travelers: live(snap.travelers).map((t) => ({ label: t.label, age_group: t.age_group, birth_year: t.birth_year, interests: t.interests })),
    existing:
      kind === "tasks"
        ? live(snap.tasks).map((t) => t.title)
        : kind === "packing"
          ? live(snap.packing).map((p) => p.title)
          : kind === "places"
            ? places.map((p) => p.name)
            : kind === "purchases"
              ? live(snap.purchases).map((p) => p.title)
              : kind === "notes"
                ? live(snap.notes).map((n) => n.title)
                : [],
    bags: live(snap.bags).map((b) => b.label),
    today,
    plan: {
      days: snap.days.map((d) => {
        // The night's hotel as the app knows it (set on the day, a booking, or a hotel stop), not a chat's suggestion.
        const stay = nightStay(snap, d);
        const lodging = stay && !stay.suggested ? stay.place : null;
        return {
          date: d.date,
          // A day imported without a city still has one: its places' city.
          city: dayCity(snap, d),
          title: d.title,
          // Lodging only to neighborhood level (SPEC §9), never its exact address.
          lodgingArea: lodging ? (lodging.area ?? lodging.city) : null,
          lodgingSet: Boolean(stay && !stay.suggested),
          weather: weather.get(d.date) ? weatherText(weather.get(d.date)!) : null,
          stops: stopsOfDay(snap, d.id).map((s) => ({
            label: stopLabel(snap, s),
            timeOfDay: s.time_of_day,
            start: s.start_time?.slice(0, 5) ?? null,
            minutes: s.duration_min,
            city: s.place_id ? (places.find((p) => p.id === s.place_id)?.city ?? null) : null,
          })),
        };
      }),
      places: places.map((p) => ({ name: p.name, city: p.city, area: p.area, category: p.category, priority: p.priority, status: p.status })),
      bookings: liveBookings(snap).map((b) => ({ kind: b.kind, title: b.title, local: bookingLocal(b) })),
    },
    weatherSummary: summarizeWeather(snap, weather),
    memories: {
      places: places.filter((p) => p.status === "visited").map((p) => ({ name: p.name, city: p.city, rating: p.rating, note: p.notes })),
      journal: live(snap.journal).map((j) => ({ date: snap.days.find((d) => d.id === j.day_id)?.date ?? null, body: j.body, rating: j.rating })),
    },
  };
}

/** Per city: temperature range and rainy days, from what the weather hook already loaded. */
function summarizeWeather(snap: TripSnapshot, weather: ReturnType<typeof knownWeather>): string[] {
  const byCity = new Map<string, { min: number; max: number; wet: number; days: number; lastYear: boolean }>();
  for (const d of snap.days) {
    const w = weather.get(d.date);
    if (!w) continue;
    const city = dayCity(snap, d) ?? "";
    const g = byCity.get(city) ?? { min: Infinity, max: -Infinity, wet: 0, days: 0, lastYear: false };
    g.min = Math.min(g.min, w.min);
    g.max = Math.max(g.max, w.max);
    g.days++;
    if ((w.rainChance ?? 0) >= 50 || (w.rainMm ?? 0) >= 2 || w.kind === "rain" || w.kind === "storm" || w.kind === "snow") g.wet++;
    if (w.source === "lastYear") g.lastYear = true;
    byCity.set(city, g);
  }
  return [...byCity.entries()].map(
    ([city, g]) =>
      `${city ? `${city}: ` : ""}${g.min}°–${g.max}°, ${g.wet ? `גשם או שלג ב-${g.wet} מתוך ${g.days} ימים` : "בלי גשם צפוי"}${g.lastYear ? " (לפי אותם תאריכים בשנה שעברה)" : " (תחזית)"}`,
  );
}
