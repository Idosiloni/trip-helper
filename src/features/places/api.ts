import type { GeoResult } from "@/lib/geo";

/** Asks our server route (cache → Nominatim → Photon). One call per explicit user action. */
export async function geocode(name: string, city?: string | null, country?: string | null): Promise<GeoResult[]> {
  const q = new URLSearchParams({ name });
  if (city) q.set("city", city);
  if (country) q.set("country", country);
  const res = await fetch(`/api/geocode?${q}`, { cache: "no-store" });
  if (!res.ok && res.status !== 502) throw new Error(`geocode ${res.status}`);
  const body = (await res.json()) as { results?: GeoResult[] };
  return body.results ?? [];
}
