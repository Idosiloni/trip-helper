import "server-only";
import type { GeoResult } from "./geo";

// Free OpenStreetMap geocoders, used per their policies:
// - Nominatim (https://operations.osmfoundation.org/policies/nominatim/): at most
//   1 request/second, an identifying User-Agent, results cached (geocode_cache),
//   no autocomplete — we only look up on an explicit tap or after an import.
// - Photon (https://photon.komoot.io): fair use; only as a fallback, same pace.

const USER_AGENT = "TripHelper/0.1 (family trip planner; https://tripplanner-pi-eight.vercel.app)";
const MIN_GAP_MS = 1100;

// Serialize requests per server instance so we never exceed ~1/second.
let queue: Promise<unknown> = Promise.resolve();
let last = 0;
function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

type NominatimHit = { lat: string; lon: string; display_name: string; type?: string; category?: string };

export async function nominatim(query: string): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=he,en&q=${encodeURIComponent(query)}`;
  const res = await paced(() => fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) }));
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];
  return hits.map((h) => ({ lat: Number(h.lat), lng: Number(h.lon), label: h.display_name, kind: h.type ?? h.category }));
}

type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: { name?: string; street?: string; city?: string; state?: string; country?: string; osm_value?: string } };

export async function photon(query: string): Promise<GeoResult[]> {
  const url = `https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(query)}`;
  const res = await paced(() => fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) }));
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? []).map((f) => {
    const p = f.properties;
    const label = [p.name, p.street, p.city, p.state, p.country].filter(Boolean).join(", ");
    return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], label, kind: p.osm_value };
  });
}
