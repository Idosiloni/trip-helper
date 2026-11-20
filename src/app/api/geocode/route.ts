import { NextResponse, type NextRequest } from "next/server";
import { geocodeKey, type GeoResult } from "@/lib/geo";
import { nominatim, photon } from "@/lib/geocode-providers";
import { serverSupabase } from "@/lib/supabase/server";

/**
 * GET /api/geocode?name=…&city=…&country=…
 * Signed-in users only. Cache first (shared geocode_cache), then Nominatim,
 * then Photon. Returns up to 5 candidates; the app always asks the user to
 * confirm the pin (SPEC 8.2).
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim().slice(0, 120) ?? "";
  const city = req.nextUrl.searchParams.get("city")?.trim().slice(0, 60) ?? "";
  const country = req.nextUrl.searchParams.get("country")?.trim().slice(0, 60) ?? "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const db = await serverSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = geocodeKey(name, city, country);
  const { data: cached } = await db.from("geocode_cache").select("results, provider").eq("query_key", key).maybeSingle();
  if (cached) return NextResponse.json({ results: cached.results as GeoResult[], provider: cached.provider, cached: true });

  const query = [name, city, country].filter(Boolean).join(", ");
  let results: GeoResult[] = [];
  let provider = "nominatim";
  try {
    results = await nominatim(query);
  } catch (e) {
    console.error("nominatim failed", e);
  }
  if (results.length === 0) {
    provider = "photon";
    try {
      results = await photon(query);
    } catch (e) {
      console.error("photon failed", e);
      return NextResponse.json({ results: [], provider, cached: false, error: "providers_unavailable" }, { status: 502 });
    }
  }
  // Cache even empty answers so the same miss isn't retried against the provider.
  await db.from("geocode_cache").insert({ query_key: key, results, provider });
  return NextResponse.json({ results, provider, cached: false });
}
