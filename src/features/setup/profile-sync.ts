import { normalizeForCompare } from "@/lib/text";
import { parseTripProfile, type TripProfile } from "@/lib/trip-profile";
import { dayCity, isTransitCity } from "../itinerary/helpers";
import type { TripSnapshot } from "../trip-data/types";

export type CityRun = { name: string; from: string; to: string };

const HOME_COUNTRIES = /^(ישראל|israel)$/i;

/**
 * The plan's cities in order, one entry per stay: a city you leave and come back
 * to (Tokyo at the start and at the end) is two stays with their own dates.
 */
export function planCities(snap: TripSnapshot): CityRun[] {
  const out: CityRun[] = [];
  let last: string | null = null;
  for (const d of [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const name = dayCity(snap, d);
    if (!name || isTransitCity(name)) {
      last = null;
      continue;
    }
    const run = out.at(-1);
    if (run && last !== null && normalizeForCompare(last) === normalizeForCompare(name)) run.to = d.date;
    else out.push({ name, from: d.date, to: d.date });
    last = name;
  }
  return out;
}

/** Plan stays the profile doesn't have (same city name and the same first day). */
export function missingFromProfile(profile: TripProfile, runs: CityRun[]): CityRun[] {
  const cities = profile.destinations.flatMap((d) => d.cities);
  return runs.filter((r) => !cities.some((c) => normalizeForCompare(c.name) === normalizeForCompare(r.name) && (c.from === r.from || (!c.from && runs.filter((x) => normalizeForCompare(x.name) === normalizeForCompare(r.name)).length === 1))));
}

/**
 * Profile cities whose dates the plan contradicts get the plan's dates (the first
 * stay in that city). Fixes ranges like "Tokyo 28.11–11.12" written when a city
 * that appears twice was once treated as one stay.
 */
export function fixProfileDates(dest: TripProfile["destinations"], runs: CityRun[]): TripProfile["destinations"] {
  return dest.map((d) => ({
    ...d,
    cities: d.cities.map((c) => {
      const mine = runs.filter((r) => normalizeForCompare(r.name) === normalizeForCompare(c.name));
      if (!mine.length || !c.from) return c;
      if (mine.some((r) => r.from === c.from && r.to === c.to)) return c;
      const first = mine.find((r) => r.from === c.from) ?? mine[0];
      return { ...c, from: first.from, to: first.to };
    }),
  }));
}

/**
 * Adds plan cities to the profile's destinations. With one country in the profile
 * they go there; otherwise `countryOf` (a geocoder) says where each belongs, and
 * a city it can't place is left out rather than guessed.
 */
export function mergePlanCities(dest: TripProfile["destinations"], missing: CityRun[], countryOf: (city: string) => string | null): TripProfile["destinations"] {
  const out = dest.map((d) => ({ ...d, cities: [...d.cities] }));
  const only = dest.length === 1 ? dest[0].country : null;
  for (const r of missing) {
    const country = only ?? countryOf(r.name);
    if (!country || HOME_COUNTRIES.test(country.trim())) continue;
    let d = out.find((x) => normalizeForCompare(x.country) === normalizeForCompare(country));
    if (!d) {
      if (out.length >= 10) continue;
      d = { country, cities: [] };
      out.push(d);
    }
    if (d.cities.length < 20) d.cities.push({ name: r.name.slice(0, 60), from: r.from, to: r.to, area: "" });
  }
  return out;
}

async function countryOfCity(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=1&language=he`);
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: { country?: string }[] };
    return json.results?.[0]?.country?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Brings the trip profile up to date with the plan's cities. Returns the new
 * destinations, or null when nothing needs to change (so callers never write
 * the profile for no reason).
 */
export async function profileUpdateFromPlan(snap: TripSnapshot): Promise<TripProfile["destinations"] | null> {
  const profile = parseTripProfile(snap.trip?.profile);
  const runs = planCities(snap);
  const fixed = fixProfileDates(profile.destinations, runs);
  const missing = missingFromProfile({ ...profile, destinations: fixed }, runs);
  const countries = new Map<string, string | null>();
  if (fixed.length !== 1) {
    for (const r of missing) if (!countries.has(r.name)) countries.set(r.name, await countryOfCity(r.name));
  }
  const next = mergePlanCities(fixed, missing, (c) => countries.get(c) ?? null);
  return JSON.stringify(next) === JSON.stringify(profile.destinations) ? null : next;
}
