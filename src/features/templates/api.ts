import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { TemplatePayload } from "@/lib/templates/builtin";

export type MyTemplate = { id: string; name: string; payload: TemplatePayload; created_at: string };

export async function listMyTemplates(): Promise<MyTemplate[]> {
  const { data, error } = await supabase().from("templates").select("id, name, payload, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as MyTemplate[];
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase().from("templates").delete().eq("id", id);
  if (error) throw error;
}

export async function saveTripAsTemplate(tripId: string, name: string): Promise<string> {
  const { data, error } = await supabase().rpc("save_trip_as_template", { p_trip_id: tripId, p_name: name });
  if (error) throw error;
  return data;
}

export async function duplicateTrip(tripId: string, name: string, start: string | null, end: string | null): Promise<string> {
  const { data, error } = await supabase().rpc("duplicate_trip", {
    p_trip_id: tripId,
    p_name: name,
    p_start_date: start ?? undefined,
    p_end_date: end ?? undefined,
  });
  if (error) throw error;
  return data.id;
}

export const asJson = (p: TemplatePayload) => p as unknown as Json;
