import { parseTripProfile } from "@/lib/trip-profile";
import { formatDateRange } from "@/lib/dates";
import { googleMapsSearchUrl } from "@/lib/geo";
import { dayCity, isSuggestedNote, isTransitCity, nightStay, shortDate, stays, stopLabel, stopsOfDay, weekday } from "../itinerary/helpers";
import { isJourneyStop } from "../itinerary/insights";
import { planCities } from "../setup/profile-sync";
import type { Place, TripSnapshot } from "../trip-data/types";
import { byPosition } from "@/lib/position";

// "The trip guide": the whole trip as a document to print or save as PDF, and to hand
// to someone flying to the same place. Plan, places, where we slept and tips.
// Leaves out people's names, booking codes and anything else personal.

export type GuideStop = { time: string | null; part: "morning" | "noon" | "evening" | null; name: string; note: string | null; transport: string | null; mapsUrl: string | null; must: boolean };
export type GuideDay = { n: number; date: string; label: string; city: string | null; title: string | null; summary: string | null; planB: string | null; stay: string | null; staySuggested: boolean; stops: GuideStop[] };
export type GuidePlace = { name: string; category: Place["category"]; area: string | null; note: string | null; must: boolean; rating: number | null; visited: boolean; mapsUrl: string };
export type Guide = {
  name: string;
  overview: string | null;
  dates: string | null;
  nights: number | null;
  route: { city: string; from: string; to: string }[];
  days: GuideDay[];
  cities: { city: string; stays: string[]; places: GuidePlace[] }[];
  tips: { kind: string; title: string; body: string | null }[];
};

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

export function buildGuide(snap: TripSnapshot): Guide {
  const trip = snap.trip!;
  const days = [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const guideDays: GuideDay[] = days.map((d, i) => {
    const stay = nightStay(snap, d);
    return {
      n: i + 1,
      date: d.date,
      label: `${weekday(d.date)} ${shortDate(d.date)}`,
      city: dayCity(snap, d),
      title: d.title,
      summary: d.notes ?? null,
      planB: d.plan_b ?? null,
      stay: stay && !isTransitCity(dayCity(snap, d)) ? stay.name : null,
      staySuggested: Boolean(stay?.suggested),
      stops: [...stopsOfDay(snap, d.id)].sort(byPosition).map((s) => {
        const p = s.place_id ? snap.places.find((x) => x.id === s.place_id && !x.deleted_at) : null;
        return {
          time: s.start_time ? s.start_time.slice(0, 5) : null,
          part: s.time_of_day,
          name: stopLabel(snap, s),
          note: s.notes ?? p?.notes ?? null,
          transport: s.transport_note,
          mapsUrl: p ? (p.maps_url ?? googleMapsSearchUrl(p)) : null,
          must: p?.priority === "must",
        };
      }),
    };
  });

  const route = planCities(snap);
  const order = route.map((c) => c.name);
  const places = live(snap.places).filter((p) => p.status !== "skipped");
  const byCity = new Map<string, { stays: Set<string>; places: GuidePlace[] }>();
  // "טוקיו / קנאזאווה" (a travel day): the place belongs to where it is, the first city.
  const cityOf = (name: string | null) => (name ?? "").split("/")[0].trim();
  // Hotels go under the city we slept in, night by night (not the city of the day we checked in).
  const slept = new Map<string, Set<string>>();
  for (const st of stays(snap))
    for (const n of st.nights) {
      const stay = nightStay(snap, n);
      if (stay && !stay.suggested) (slept.get(st.city) ?? slept.set(st.city, new Set()).get(st.city)!).add(stay.name);
    }
  const sleptAnywhere = new Set([...slept.values()].flatMap((x) => [...x]));
  for (const p of places) {
    // Flights and trains are how we got there, not places to recommend.
    if (isJourneyStop(p.name)) continue;
    const key = cityOf(p.city);
    if (!byCity.has(key)) byCity.set(key, { stays: new Set(), places: [] });
    const entry = byCity.get(key)!;
    if (p.category === "lodging") {
      if (!sleptAnywhere.has(p.name) && !isSuggestedNote(p.notes)) entry.stays.add(p.name);
      continue;
    }
    entry.places.push({ name: p.name, category: p.category, area: p.area, note: p.notes, must: p.priority === "must", rating: p.rating, visited: p.status === "visited", mapsUrl: p.maps_url ?? googleMapsSearchUrl(p) });
  }
  for (const [city, names] of slept) for (const n of names) (byCity.get(city) ?? byCity.set(city, { stays: new Set(), places: [] }).get(city)!).stays.add(n);
  const cities = [...byCity.entries()]
    .map(([city, v]) => ({
      city,
      stays: [...v.stays],
      places: v.places.sort((a, b) => Number(b.must) - Number(a.must) || (b.rating ?? 0) - (a.rating ?? 0)),
    }))
    .filter((c) => c.places.length || c.stays.length)
    .sort((a, b) => {
      const ia = order.indexOf(a.city);
      const ib = order.indexOf(b.city);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });

  return {
    name: trip.name,
    overview: parseTripProfile(trip.profile).overview || null,
    dates: trip.start_date ? formatDateRange(trip.start_date, trip.end_date) : null,
    nights: trip.start_date && trip.end_date ? Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000) : null,
    route: route.map((r) => ({ city: r.name, from: r.from, to: r.to })),
    days: guideDays,
    cities,
    tips: live(snap.notes)
      .filter((n) => n.kind !== "emergency")
      .map((n) => ({ kind: n.kind, title: n.title, body: n.body })),
  };
}
