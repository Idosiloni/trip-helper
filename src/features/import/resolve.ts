import { travelerNames } from "@/lib/prompts/context";
import { normalizeForCompare } from "@/lib/text";
import { parseTripProfile } from "@/lib/trip-profile";
import type { TripSnapshot } from "../trip-data/types";

const EVERYONE = ["כולם", "משותף", "כל המשפחה", "everyone", "all", "shared", "family", "everybody"].map(normalizeForCompare);

/**
 * Maps a chat's "for" value back to a traveler id. Accepts the real label
 * and the anonymized name the prompt used ("מבוגר 1", "ילד, 8").
 * Returns null for "everyone"/shared, undefined when nothing matches.
 */
export function makeTravelerResolver(snap: TripSnapshot, today: string) {
  const travelers = snap.travelers.filter((t) => !t.deleted_at);
  const trip = snap.trip!;
  const anon = travelerNames({
    tripName: trip.name,
    startDate: trip.start_date,
    endDate: trip.end_date,
    profile: { ...parseTripProfile(trip.profile), namesInPrompts: false },
    travelers: travelers.map((t) => ({ label: t.label, age_group: t.age_group, birth_year: t.birth_year, interests: t.interests })),
    existing: [],
    bags: [],
    today,
  });
  const map = new Map<string, string>();
  travelers.forEach((t, i) => {
    map.set(normalizeForCompare(t.label), t.id);
    map.set(normalizeForCompare(anon[i]), t.id);
  });
  return (value: string | undefined): string | null | undefined => {
    if (!value) return null;
    const k = normalizeForCompare(value);
    if (EVERYONE.includes(k)) return null;
    return map.get(k);
  };
}
