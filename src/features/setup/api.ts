import type { TemplatePayload } from "@/lib/templates/builtin";
import { ageGroupOf } from "@/lib/import/whole";
import { keyAfter, keysAfter } from "@/lib/position";
import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { TripProfile } from "@/lib/trip-profile";

/**
 * Creates a trip (create_trip makes me the owner), saves its destinations,
 * and adds me as the first traveler so tasks can be assigned to me right away.
 */
export async function createTripWithProfile(input: {
  name: string;
  color: string;
  start: string | null;
  end: string | null;
  destinations: TripProfile["destinations"];
  myName: string;
  myUserId: string;
  /** Start the lists from a template (built-in or mine). */
  template?: TemplatePayload | null;
  /** Everyone else who's traveling (they don't need the app). */
  others?: { name: string; age?: number }[];
}): Promise<string> {
  const db = supabase();
  const { data: trip, error } = input.template
    ? await db.rpc("create_trip_from_template", {
        p_name: input.name,
        p_theme_color: input.color,
        // SQL takes null for "no dates yet"; the generated types don't say so.
        p_start_date: input.start as string,
        p_end_date: input.end as string,
        p_payload: input.template as unknown as Json,
      })
    : await db.rpc("create_trip", {
        p_name: input.name,
        p_theme_color: input.color,
        p_start_date: input.start ?? undefined,
        p_end_date: input.end ?? undefined,
      });
  if (error) throw error;
  if (input.destinations.length) {
    const { error: e2 } = await db.rpc("patch_trip_profile", { p_trip_id: trip.id, p_patch: { destinations: input.destinations } as unknown as Json });
    if (e2) throw e2;
  }
  const { error: e3 } = await db.from("travelers").insert({
    trip_id: trip.id,
    label: input.myName.slice(0, 40) || "אני",
    linked_user_id: input.myUserId,
    position: keyAfter(null),
  });
  if (e3) throw e3;
  const others = (input.others ?? []).slice(0, 15);
  if (others.length) {
    const year = Number((input.start ?? new Date().toISOString()).slice(0, 4));
    const positions = keysAfter(keyAfter(null), others.length);
    const { error: e4 } = await db.from("travelers").insert(
      others.map((x, i) => ({
        trip_id: trip.id,
        label: x.name.slice(0, 40),
        age_group: ageGroupOf(x.age),
        birth_year: x.age !== undefined && x.age < 18 ? year - x.age : null,
        position: positions[i],
      })),
    );
    if (e4) throw e4;
  }
  return trip.id;
}

/** Merge only the given top-level profile keys (no overwrites of other keys). */
export async function patchProfile(tripId: string, patch: Partial<TripProfile>) {
  const { data, error } = await supabase().rpc("patch_trip_profile", { p_trip_id: tripId, p_patch: patch as unknown as Json });
  if (error) throw error;
  return data;
}
