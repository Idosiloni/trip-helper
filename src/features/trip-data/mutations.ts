"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueue, isNetworkError, isOffline } from "@/lib/offline/outbox";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { TripStore } from "./store";
import { TABLES, type ListKey } from "./types";

type TableName = keyof Database["public"]["Tables"];
type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];

export class MutationError extends Error {}

/** No connection: keep the local change and queue it (SPEC §10). */
async function queue(store: TripStore, key: ListKey, rowId: string, kind: "insert" | "patch", values: Record<string, unknown>) {
  const { me } = store.getSnapshot();
  if (!me.userId) return false;
  await enqueue({ userId: me.userId, tripId: store.tripId, key, table: TABLES[key], rowId, kind, values });
  await store.notePending();
  return true;
}

const offlineNow = isOffline;

// These helpers are generic over table names, which the typed client can't
// express; the signatures below carry the per-table Update/Insert types instead.
const untyped = () => supabase() as unknown as SupabaseClient;

/**
 * Optimistic, field-level update: applies `patch` locally right away, sends
 * only those columns, and rolls back (and throws) if the server refuses.
 */
export async function patchRow<K extends ListKey>(store: TripStore, key: K, id: string, patch: Update<(typeof TABLES)[K]>) {
  const table = TABLES[key];
  const before = (store.getSnapshot()[key] as unknown as { id: string }[]).find((r) => r.id === id);
  store.upsertLocal(key, { id, ...(patch as object) });
  if (offlineNow() && (await queue(store, key, id, "patch", patch as Record<string, unknown>))) {
    return (store.getSnapshot()[key] as unknown as { id: string }[]).find((r) => r.id === id);
  }
  const { data, error, status } = await untyped()
    .from(table)
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error && isNetworkError(error, status) && (await queue(store, key, id, "patch", patch as Record<string, unknown>))) {
    return (store.getSnapshot()[key] as unknown as { id: string }[]).find((r) => r.id === id);
  }
  if (error || !data) {
    if (before) store.upsertLocal(key, before as { id: string });
    throw new MutationError(error?.message ?? "not allowed");
  }
  store.upsertLocal(key, data as { id: string });
  return data;
}

/** Inserts with a client-generated id, so the row appears instantly and realtime echoes merge into it. */
export async function insertRow<K extends ListKey>(store: TripStore, key: K, row: Omit<Insert<(typeof TABLES)[K]>, "trip_id" | "id">) {
  const table = TABLES[key];
  const id = crypto.randomUUID();
  const full = { ...row, id, trip_id: store.tripId } as Record<string, unknown>;
  const now = new Date().toISOString();
  store.upsertLocal(key, { created_at: now, updated_at: now, deleted_at: null, ...full, id });
  const values = Object.fromEntries(Object.entries(full).filter(([k]) => k !== "id" && k !== "trip_id"));
  if (offlineNow() && (await queue(store, key, id, "insert", values))) return { id };
  const { data, error, status } = await untyped()
    .from(table)
    .insert(full)
    .select()
    .single();
  if (error && isNetworkError(error, status) && (await queue(store, key, id, "insert", values))) return { id };
  if (error) {
    store.removeLocal(key, id);
    throw new MutationError(error.message);
  }
  store.upsertLocal(key, data as { id: string });
  return data as { id: string };
}

/** Soft delete (moves to the trash). Returns an undo function. */
export async function softDelete(store: TripStore, key: ListKey, id: string) {
  await patchRow(store, key, id, { deleted_at: new Date().toISOString() } as never);
  return () => patchRow(store, key, id, { deleted_at: null } as never);
}

export async function patchTrip(store: TripStore, patch: Update<"trips">) {
  const before = store.getSnapshot().trip;
  store.setTripLocal(patch as never);
  const { error } = await supabase().from("trips").update(patch).eq("id", store.tripId);
  if (error) {
    if (before) store.setTripLocal(before);
    throw new MutationError(error.message);
  }
}
