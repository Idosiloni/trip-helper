import { citiesFromPlan } from "@/lib/prompts/context";
import { formatDateRange } from "@/lib/dates";
import { parseTripProfile } from "@/lib/trip-profile";
import { stopLabel, stopsOfDay } from "../itinerary/helpers";
import type { Place, TripSnapshot } from "../trip-data/types";

// "The trip in one look" (for someone flying to the same place next).
// Shared as text only: no names of family members, bookings, codes or addresses.

export type TripSummary = {
  name: string;
  dates: string | null;
  route: string[];
  days: { date: string; city: string | null; title: string | null; stops: string[] }[];
  /** Visited places grouped by city, best rated first. */
  byCity: { city: string; places: { name: string; category: Place["category"]; rating: number | null; note: string | null; mapsUrl: string | null }[] }[];
  favorites: { name: string; city: string | null; rating: number }[];
  tips: { title: string; body: string | null }[];
};

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

export function buildSummary(snap: TripSnapshot): TripSummary {
  const trip = snap.trip!;
  const profile = parseTripProfile(trip.profile);
  const fromProfile = profile.destinations.flatMap((d) => (d.cities.length ? d.cities.map((c) => c.name) : [d.country]));
  const route = fromProfile.length ? fromProfile : citiesFromPlan(snap.days).map((c) => c.name);
  const places = live(snap.places);
  // Before the trip ends nothing is "visited" yet: then the summary shows the must-sees.
  const visited = places.filter((p) => p.status === "visited");
  const shown = visited.length ? visited : places.filter((p) => p.priority === "must");
  const groups = new Map<string, TripSummary["byCity"][number]["places"]>();
  for (const p of [...shown].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))) {
    const city = p.city ?? "";
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city)!.push({ name: p.name, category: p.category, rating: p.rating, note: p.notes, mapsUrl: p.maps_url });
  }
  return {
    name: trip.name,
    dates: trip.start_date ? formatDateRange(trip.start_date, trip.end_date) : null,
    route: [...new Set(route)],
    days: snap.days
      .map((d) => ({ date: d.date, city: d.city, title: d.title, stops: stopsOfDay(snap, d.id).map((s) => stopLabel(snap, s)).filter(Boolean) }))
      .filter((d) => d.stops.length || d.title),
    byCity: [...groups.entries()].map(([city, ps]) => ({ city, places: ps })),
    favorites: visited
      .filter((p) => (p.rating ?? 0) >= 4)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 8)
      .map((p) => ({ name: p.name, city: p.city, rating: p.rating! })),
    tips: live(snap.notes)
      .filter((n) => n.kind === "tip" || n.kind === "money" || n.kind === "etiquette")
      .slice(0, 12)
      .map((n) => ({ title: n.title, body: n.body })),
  };
}

/** Plain text for WhatsApp / email. Labels are passed in (Hebrew strings from messages). */
export function summaryText(
  s: TripSummary,
  l: { route: string; plan: string; favorites: string; places: string; tips: string; otherCity: string; day: (n: number) => string },
): string {
  const out: string[] = [`*${s.name}*`];
  if (s.dates) out.push(s.dates);
  if (s.route.length) out.push(`${l.route}: ${s.route.join(" ← ")}`);
  if (s.favorites.length) {
    out.push("", `*${l.favorites}*`);
    for (const f of s.favorites) out.push(`• ${f.name}${f.city ? ` (${f.city})` : ""} ${"★".repeat(f.rating)}`);
  }
  if (s.days.length) {
    out.push("", `*${l.plan}*`);
    s.days.forEach((d, i) => {
      const head = `${l.day(i + 1)}${d.city ? ` · ${d.city}` : ""}${d.title ? ` · ${d.title}` : ""}`;
      out.push(d.stops.length ? `${head}: ${d.stops.join(", ")}` : head);
    });
  }
  if (s.byCity.length) {
    out.push("", `*${l.places}*`);
    for (const g of s.byCity) {
      out.push(`${g.city || l.otherCity}:`);
      for (const p of g.places) out.push(`• ${p.name}${p.rating ? ` ${"★".repeat(p.rating)}` : ""}${p.note ? `: ${p.note.replace(/\s+/g, " ").slice(0, 160)}` : ""}`);
    }
  }
  if (s.tips.length) {
    out.push("", `*${l.tips}*`);
    for (const t of s.tips) out.push(`• ${t.title}${t.body ? `: ${t.body.replace(/\s+/g, " ").slice(0, 200)}` : ""}`);
  }
  return out.join("\n");
}
