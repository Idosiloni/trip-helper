import { normalizeForCompare } from "./text";

// Map helpers (SPEC §8). Google Maps is used only through its free, keyless
// "Maps URLs"; all points shown in-app come from OpenStreetMap geocoding.

export type LatLng = { lat: number; lng: number };
export type PlaceLike = { name: string; city?: string | null; area?: string | null; lat?: number | null; lng?: number | null };

const hasPoint = (p: PlaceLike): p is PlaceLike & LatLng => typeof p.lat === "number" && typeof p.lng === "number";

/** "Open in Google Maps": by point when we have one, else a text search. */
export function googleMapsSearchUrl(p: PlaceLike): string {
  const query = hasPoint(p) ? `${p.lat},${p.lng}` : [p.name, p.area, p.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** "Navigate": Google Maps directions from the current location. */
export function googleMapsDirectionsUrl(p: PlaceLike, mode: "walking" | "transit" | "driving" = "transit"): string {
  const dest = hasPoint(p) ? `${p.lat},${p.lng}` : [p.name, p.area, p.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

/**
 * The whole day as one Google Maps route (stop after stop, in order). Google
 * takes about ten points in a link; longer days are cut to the first ten.
 */
export function googleMapsRouteUrl(points: LatLng[]): string | null {
  if (points.length < 2) return null;
  return `https://www.google.com/maps/dir/${points
    .slice(0, 10)
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join("/")}`;
}

/**
 * Reads coordinates out of a pasted Google Maps link. Works for full links
 * (".../@35.01,135.77,17z", "!3d35.01!4d135.77", "?q=35.01,135.77", "ll=").
 * Short links (maps.app.goo.gl) can't be expanded in the browser → null.
 */
export function parseGoogleMapsLink(url: string): LatLng | null {
  const s = decodeURIComponent(url.trim());
  const patterns = [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

export const isShortMapsLink = (url: string) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(url.trim());

/** Cache key for a lookup: normalized name|city|country. */
export function geocodeKey(name: string, city?: string | null, country?: string | null): string {
  return [name, city ?? "", country ?? ""].map((x) => normalizeForCompare(x)).join("|").slice(0, 300);
}

/** Great-circle distance in km (for "near me" and sanity checks). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type GeoResult = LatLng & { label: string; kind?: string };
