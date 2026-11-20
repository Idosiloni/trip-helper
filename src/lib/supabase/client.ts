"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

export type TypedClient = SupabaseClient<Database>;

let client: TypedClient | null = null;

/** One browser client per tab; it shares the session cookies the proxy refreshes. */
export function supabase(): TypedClient {
  if (!client) {
    client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  }
  return client;
}
