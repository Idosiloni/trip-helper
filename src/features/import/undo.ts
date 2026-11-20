import { supabase } from "@/lib/supabase/client";

export type LastImport = { id: string; kind: string; created_at: string };

/** The trip's latest paste that can still be undone (up to 7 days, not undone yet). */
export async function lastImport(tripId: string): Promise<LastImport | null> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase()
    .from("ai_imports")
    .select("id, kind, created_at")
    .eq("trip_id", tripId)
    .is("undone_at", null)
    .neq("kind", "bookings")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Moves what a paste added to the trash and brings back stops it replaced. Returns how many rows moved. */
export async function undoImport(id: string): Promise<number> {
  const { data, error } = await supabase().rpc("undo_import", { p_import_id: id });
  if (error) throw error;
  return data ?? 0;
}
