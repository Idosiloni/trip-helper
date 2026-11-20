"use client";

import { useEffect, useState } from "react";
import { parseTripProfile } from "@/lib/trip-profile";
import { geocodeCity, weatherFor, type DayWeather } from "@/lib/weather";
import { dayCity, stopsOfDay } from "../itinerary/helpers";
import type { TripSnapshot } from "../trip-data/types";

type Spot = { key: string; lat?: number; lng?: number; city?: string; dates: string[] };

/** Where each day happens: its places, else places in its city, else the city by name. */
export function daySpots(snap: TripSnapshot): Spot[] {
  const located = snap.places.filter((p) => !p.deleted_at && p.lat !== null && p.lng !== null);
  const fallbackCity = parseTripProfile(snap.trip?.profile).destinations[0]?.cities[0]?.name ?? null;
  const spots = new Map<string, Spot>();
  for (const day of snap.days) {
    const ids = new Set(stopsOfDay(snap, day.id).map((s) => s.place_id));
    let pts = located.filter((p) => ids.has(p.id));
    const city = dayCity(snap, day) ?? fallbackCity;
    if (!pts.length && city) pts = located.filter((p) => p.city?.trim() === city);
    let spot: Omit<Spot, "dates"> | null = null;
    if (pts.length) {
      const lat = pts.reduce((a, p) => a + p.lat!, 0) / pts.length;
      const lng = pts.reduce((a, p) => a + p.lng!, 0) / pts.length;
      spot = { key: `${lat.toFixed(1)},${lng.toFixed(1)}`, lat, lng };
    } else if (city) spot = { key: `city:${city}`, city };
    if (!spot) continue;
    if (!spots.has(spot.key)) spots.set(spot.key, { ...spot, dates: [] });
    spots.get(spot.key)!.dates.push(day.date);
  }
  return [...spots.values()];
}

// Shared across screens (and read by prompts): date → weather.
const known = new Map<string, Map<string, DayWeather>>();
export function knownWeather(tripId: string): Map<string, DayWeather> {
  return known.get(tripId) ?? new Map();
}

/** The trip's weather by date. Empty until loaded; works offline from the device cache. */
export function useTripWeather(snap: TripSnapshot, today: string | null): Map<string, DayWeather> {
  const tripId = snap.trip?.id ?? "";
  const spots = daySpots(snap);
  const signature = spots.map((s) => `${s.key}=${s.dates.join(",")}`).join("|");
  const [byDate, setByDate] = useState<Map<string, DayWeather>>(() => knownWeather(tripId));

  useEffect(() => {
    if (!today || !signature) return;
    let cancelled = false;
    void (async () => {
      const out = new Map<string, DayWeather>();
      for (const s of daySpots(snap)) {
        const at = s.lat !== undefined && s.lng !== undefined ? { lat: s.lat, lng: s.lng } : s.city ? await geocodeCity(s.city) : null;
        if (!at) continue;
        for (const w of await weatherFor(at.lat, at.lng, s.dates, today)) out.set(w.date, w);
      }
      if (cancelled || !out.size) return;
      known.set(tripId, out);
      setByDate(out);
    })();
    return () => {
      cancelled = true;
    };
    // Re-run only when where/when changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, today, tripId]);

  return byDate;
}
