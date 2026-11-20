import { googleMapsSearchUrl } from "@/lib/geo";
import { byPosition } from "@/lib/position";
import { weatherText, type DayWeather } from "@/lib/weather";
import type { TripDay, TripSnapshot } from "../trip-data/types";
import { bookingsOnDay, dayCity, nightStay, shortDate, stopLabel, stopsOfDay, weekday } from "./helpers";
import { buildTimeline } from "./timeline";

const TOD: Record<string, string> = { morning: "בוקר", noon: "צהריים", evening: "ערב" };
const KIND: Record<string, string> = { flight: "טיסה", hotel: "מלון", train: "רכבת", car: "רכב", attraction: "כרטיס", other: "הזמנה" };

/**
 * One day of the plan as plain text for a family WhatsApp group:
 * the date and city, the weather, then the stops in order with a map link for each.
 */
export function dayText(snap: TripSnapshot, day: TripDay, opts: { weather?: DayWeather; links?: boolean } = {}): string {
  const n = snap.days.findIndex((d) => d.id === day.id) + 1;
  const city = dayCity(snap, day);
  const lines: string[] = [`*יום ${n} · ${weekday(day.date)} ${shortDate(day.date)}${city ? ` · ${city}` : ""}*`];
  if (day.title) lines.push(day.title);
  if (opts.weather) lines.push(`מזג אוויר: ${weatherText(opts.weather)}`);
  lines.push("");

  const timeline = buildTimeline([...stopsOfDay(snap, day.id)].sort(byPosition), bookingsOnDay(snap, day));
  for (const x of timeline) {
    if (x.type === "section") continue;
    if (x.type === "booking") {
      const what = x.booking.kind === "hotel" ? (x.edge === "start" ? "צ'ק-אין" : "צ'ק-אאוט") : KIND[x.booking.kind];
      lines.push(`${x.time ?? ""} ${what}: ${x.booking.title}`.trim());
      continue;
    }
    const s = x.stop;
    const when = s.start_time ? s.start_time.slice(0, 5) : s.time_of_day ? TOD[s.time_of_day] : "";
    const place = s.place_id ? snap.places.find((p) => p.id === s.place_id && !p.deleted_at) : null;
    lines.push(`${when ? `${when} · ` : "• "}${stopLabel(snap, s)}`);
    if (s.transport_note) lines.push(`   ${s.transport_note}`);
    if (opts.links !== false && place) lines.push(`   ${place.maps_url ?? googleMapsSearchUrl(place)}`);
  }
  if (timeline.length === 0) lines.push(day.flexible ? "יום חופשי" : "עוד אין תוכנית");

  if (day.plan_b) lines.push("", `תוכנית ב׳: ${day.plan_b}`);
  const stay = nightStay(snap, day);
  if (stay) {
    lines.push("");
    lines.push(`ישנים ב: ${stay.name}${stay.suggested ? " (הצעה, עוד לא סגור)" : ""}`);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
