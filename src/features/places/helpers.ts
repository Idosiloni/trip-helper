import { dayCity } from "../itinerary/helpers";
import { isJourneyStop } from "../itinerary/insights";
import { parseTripProfile } from "@/lib/trip-profile";
import type { Place, TripSnapshot } from "../trip-data/types";

export const located = (p: Place): p is Place & { lat: number; lng: number } => typeof p.lat === "number" && typeof p.lng === "number";

/** Places still waiting for a confirmed pin (fresh imports, or a guess not yet confirmed). */
export const needsPin = (p: Place) => !p.deleted_at && (p.geocode_status === "pending" || p.geocode_status === "found") && !isTransportPlace(p);

/** The country for a city, from the trip profile (helps the geocoder). */
export function countryFor(snap: TripSnapshot, city: string | null): string | null {
  const profile = parseTripProfile(snap.trip?.profile);
  if (city) {
    const d = profile.destinations.find((x) => x.cities.some((c) => c.name === city));
    if (d) return d.country;
  }
  return profile.destinations.length === 1 ? profile.destinations[0].country : null;
}

/** The trip's cities: from the profile, plus any the plan's days name (in plan order). */
export function profileCities(snap: TripSnapshot): string[] {
  // A city can come twice in the profile (Tokyo at the start and at the end): one entry each.
  const out = [...new Set(parseTripProfile(snap.trip?.profile).destinations.flatMap((d) => d.cities.map((c) => primaryCity(c.name)!)))];
  for (const d of [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const c = primaryCity(dayCity(snap, d));
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * The city a place belongs to. Chats write travel days as "טוקיו / קנאזאווה":
 * the place is where it starts, the first city. The full text stays on the place.
 */
export function primaryCity(city: string | null | undefined): string | null {
  const first = (city ?? "").split("/")[0].trim();
  return first || null;
}

/**
 * Flights, trains and the landing at home, imported as "places" by a full-plan paste.
 * They are how we get there, not places to visit. A restaurant or a hotel never counts.
 */
export function isTransportPlace(p: Pick<Place, "name" | "category" | "city">): boolean {
  if (p.category === "food" || p.category === "lodging") return false;
  return isJourneyStop(p.name) || (p.category === "other" && (p.city ?? "").includes("/"));
}
