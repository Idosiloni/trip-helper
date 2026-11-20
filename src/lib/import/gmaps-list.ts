import { distanceKm } from "../geo";

// Shared Google Maps lists ("Saved" → a list → Share → link) → places.
// Google has no public API for these; the list page itself loads them from
// /maps/preview/entitylist/getlist, which answers for any list shared by link.
// Undocumented, so everything here is defensive: a shape change gives an empty
// list and the screen says so, it never throws at the user.

export type GmapsListPlace = {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  note: string | null;
  mapsUrl: string | null;
};

export type GmapsList = { title: string | null; places: GmapsListPlace[] };

const ALLOWED_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "www.google.com", "google.com", "maps.google.com"]);

/** True for links a user could paste from Google Maps' share sheet (no other hosts are fetched). */
export function isGmapsHost(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Pulls the first URL out of pasted share text ("Check out this list… https://maps.app.goo.gl/x"). */
export function firstUrl(text: string): string | null {
  return text.match(/https:\/\/[^\s<>"']+/)?.[0] ?? null;
}

/** The list id inside a full list URL (after the short link was followed). */
export function listIdFrom(url: string): string | null {
  const m = url.match(/!2s([\w-]{10,})(?:!|$|\?)/) ?? url.match(/\/placelists\/list\/([\w-]{10,})/);
  return m?.[1] ?? null;
}

export function getlistUrl(id: string): string {
  return `https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=he&gl=il&pb=!1m4!1s${encodeURIComponent(id)}!2e1!3m1!1e1!2e2!3e2!4i500!16b1`;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Parses the getlist answer (with or without the ")]}'" guard line). */
export function parseGetlist(text: string): GmapsList {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\)\]\}'\s*/, ""));
  } catch {
    return { title: null, places: [] };
  }
  const root = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : null;
  if (!root) return { title: null, places: [] };
  const entries = Array.isArray(root[8]) ? (root[8] as unknown[]) : [];
  const places: GmapsListPlace[] = [];
  for (const e of entries) {
    if (!Array.isArray(e)) continue;
    const info = Array.isArray(e[1]) ? (e[1] as unknown[]) : [];
    const coords = Array.isArray(info[5]) ? (info[5] as unknown[]) : [];
    const lat = num(coords[2]);
    const lng = num(coords[3]);
    const name = str(e[2]) ?? str(info[2]);
    if (!name || lat === null || lng === null) continue;
    const cid = Array.isArray(info[6]) ? str((info[6] as unknown[])[1]) : null;
    places.push({
      name: name.slice(0, 120),
      address: str(info[4]) ?? str(info[2]),
      lat,
      lng,
      note: str(e[3])?.slice(0, 2000) ?? null,
      mapsUrl: cid && /^\d+$/.test(cid) ? `https://maps.google.com/?cid=${cid}` : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
  }
  return { title: str(root[4]), places };
}

/** The trip city closest to a point, if one is within `maxKm` (cities a long drive away don't count). */
export function nearestCity<T extends { lat: number; lng: number }>(p: { lat: number; lng: number }, cities: (T & { name: string })[], maxKm = 80): string | null {
  let best: { name: string; d: number } | null = null;
  for (const c of cities) {
    const d = distanceKm(p, c);
    if (d <= maxKm && (!best || d < best.d)) best = { name: c.name, d };
  }
  return best?.name ?? null;
}

/** Guesses a category from the name/note ("ramen", "מוזיאון", "park"…); falls back to attraction. */
export function guessCategory(text: string): "food" | "attraction" | "shopping" | "nature" | "lodging" {
  const s = text.toLowerCase();
  if (/ramen|sushi|restaurant|cafe|café|coffee|bakery|izakaya|\bbar\b|pub|food|pizza|burger|מסעד|קפה|מאפ|אוכל|ראמן|סושי|בר /.test(s)) return "food";
  if (/hotel|hostel|ryokan|airbnb|מלון|הוסטל/.test(s)) return "lodging";
  if (/park|garden|mount|beach|lake|falls|trail|גן|פארק|הר |חוף|אגם|מפל/.test(s)) return "nature";
  if (/mall|market|shop|store|outlet|קניון|שוק|חנות/.test(s)) return "shopping";
  return "attraction";
}
