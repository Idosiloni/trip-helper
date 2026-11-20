import { normalizeForCompare } from "@/lib/text";
import type { Stop, TripSnapshot } from "../trip-data/types";
import { stopLabel } from "./helpers";

export type DoubledPlan = { days: number; remove: Stop[]; keep: number };

/**
 * An itinerary pasted again without "replace": the days hold the old stops and the
 * new ones. Finds the newest import, the days it added to, and, in each day where
 * the old and new share a stop (the sign it's the same day twice), the old stops.
 */
export function doubledPlan(snap: TripSnapshot): DoubledPlan | null {
  const live = snap.stops.filter((s) => !s.deleted_at && s.day_id);
  const imported = live.filter((s) => s.ai_import_id);
  if (!imported.length) return null;
  const newest = imported.reduce((a, b) => (a.created_at > b.created_at ? a : b)).ai_import_id;
  const fresh = live.filter((s) => s.ai_import_id === newest);
  const byDay = new Map<string, Stop[]>();
  for (const s of fresh) byDay.set(s.day_id!, [...(byDay.get(s.day_id!) ?? []), s]);
  const remove: Stop[] = [];
  let days = 0;
  let keep = 0;
  for (const [dayId, mine] of byDay) {
    // Only stops that came from an earlier paste; anything typed by hand stays.
    const older = live.filter((s) => s.day_id === dayId && s.ai_import_id && s.ai_import_id !== newest);
    if (!older.length) continue;
    const names = new Set(mine.map((s) => normalizeForCompare(stopLabel(snap, s))));
    if (!older.some((s) => names.has(normalizeForCompare(stopLabel(snap, s))))) continue;
    days++;
    keep += mine.length;
    remove.push(...older);
  }
  return days ? { days, remove, keep } : null;
}
