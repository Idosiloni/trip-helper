import { withDeviceCopy } from "@/lib/offline/cached";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { tripPhase, type TripPhase } from "@/lib/dates";

export type TripSummary = Pick<
  Tables<"trips">,
  "id" | "name" | "theme_color" | "start_date" | "end_date" | "phase_override" | "archived_at"
>;

const SUMMARY = "id, name, theme_color, start_date, end_date, phase_override, archived_at";

export function listMyTrips(): Promise<TripSummary[]> {
  return withDeviceCopy("trips", fetchMyTrips);
}

async function fetchMyTrips(): Promise<TripSummary[]> {
  const { data, error } = await supabase()
    .from("trips")
    .select(SUMMARY)
    .is("deleted_at", null)
    .order("start_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getTrip(id: string): Promise<TripSummary | null> {
  const { data, error } = await supabase().from("trips").select(SUMMARY).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTrip(input: { name: string; color: string; start: string | null; end: string | null }) {
  const { data, error } = await supabase().rpc("create_trip", {
    p_name: input.name,
    p_theme_color: input.color,
    p_start_date: input.start ?? undefined,
    p_end_date: input.end ?? undefined,
  });
  if (error) throw error;
  return data;
}

export type TripBuckets = { now: TripSummary[]; upcoming: TripSummary[]; archive: TripSummary[] };

/** Home screen grouping (SPEC §4): happening now, coming up, and archive (ended or archived). */
export function bucketTrips(trips: TripSummary[], today: string): TripBuckets {
  const buckets: TripBuckets = { now: [], upcoming: [], archive: [] };
  for (const trip of trips) {
    const phase: TripPhase = tripPhase(trip, today);
    if (trip.archived_at || phase === "after") buckets.archive.push(trip);
    else if (phase === "during") buckets.now.push(trip);
    else buckets.upcoming.push(trip);
  }
  buckets.archive.reverse(); // most recent first
  return buckets;
}
