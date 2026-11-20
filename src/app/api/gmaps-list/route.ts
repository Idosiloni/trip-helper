import { NextResponse, type NextRequest } from "next/server";
import { firstUrl, getlistUrl, isGmapsHost, listIdFrom, parseGetlist } from "@/lib/import/gmaps-list";
import { serverSupabase } from "@/lib/supabase/server";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** Follows a share short link one hop at a time, only ever to Google hosts. */
async function resolve(url: string): Promise<string | "blocked" | null> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    if (listIdFrom(current)) return current;
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    const next = res.headers.get("location");
    if (!next) return null;
    const abs = new URL(next, current).toString();
    // Google's bot check / cookie consent: Google didn't answer, the link may be fine.
    if (/\/sorry\/|consent\.google\./.test(abs)) return "blocked";
    if (!isGmapsHost(abs)) return null;
    current = abs;
  }
  return listIdFrom(current) ? current : null;
}

/**
 * GET /api/gmaps-list?url=<share link>
 * Signed-in users only. Returns the places of a Google Maps list shared by link:
 * name, address, coordinates, the list's note, and a link to the exact place.
 */
export async function GET(req: NextRequest) {
  const db = await serverSupabase();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = firstUrl(req.nextUrl.searchParams.get("url") ?? "");
  if (!raw || !isGmapsHost(raw)) return NextResponse.json({ error: "not_gmaps" }, { status: 400 });

  try {
    const full = await resolve(raw);
    if (full === "blocked") return NextResponse.json({ error: "google_failed" }, { status: 502 });
    const id = full ? listIdFrom(full) : null;
    if (!id) return NextResponse.json({ error: "not_list" }, { status: 422 });
    const res = await fetch(getlistUrl(id), { headers: { "user-agent": UA, "accept-language": "he,en;q=0.8" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return NextResponse.json({ error: "google_failed", status: res.status }, { status: 502 });
    const list = parseGetlist(await res.text());
    if (!list.places.length) return NextResponse.json({ error: "empty" }, { status: 422 });
    return NextResponse.json(list);
  } catch (e) {
    console.error("gmaps-list failed", e);
    return NextResponse.json({ error: "google_failed" }, { status: 502 });
  }
}
