import { withDeviceCopy } from "@/lib/offline/cached";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type Me = { id: string; email: string; profile: Tables<"profiles"> };

export function fetchMe(): Promise<Me | null> {
  return withDeviceCopy("me", fetchMeOnline);
}

async function fetchMeOnline(): Promise<Me | null> {
  const db = supabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError && authError.status === 0) throw authError;
  if (!auth.user) return null;
  const { data: profile, error } = await db.from("profiles").select("*").eq("id", auth.user.id).single();
  if (error) throw error;
  return { id: auth.user.id, email: auth.user.email ?? "", profile };
}

/** Field-level update: only the columns passed are sent (SPEC §11, no overwrites). */
export async function updateMyProfile(id: string, patch: { display_name?: string; avatar_color?: string }) {
  const { error } = await supabase().from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export function needsOnboarding(me: Me) {
  return me.profile.display_name.trim() === "";
}
