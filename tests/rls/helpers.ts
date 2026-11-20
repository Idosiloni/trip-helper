import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";

// RLS tests run against the dev Supabase project (no Docker locally, PLAN decision 1).
// They need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
// SUPABASE_SECRET_KEY in .env.local; without them the suites are skipped.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secret = process.env.SUPABASE_SECRET_KEY ?? "";

export const hasRlsEnv = Boolean(url && publishable && secret);

type Db = SupabaseClient<Database>;

export function admin(): Db {
  return createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anon(): Db {
  return createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Creates a throwaway confirmed user and returns a client signed in as them. */
export async function makeUser(label: string): Promise<{ id: string; db: Db }> {
  const email = `rls-${label}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const password = crypto.randomUUID();
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const db = anon();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, db };
}

export async function deleteUsers(ids: string[]) {
  const a = admin();
  await Promise.all(ids.map((id) => a.auth.admin.deleteUser(id)));
}
