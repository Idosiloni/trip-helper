// Read with literal property names so Next.js can inline them into the client bundle.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const hasSupabaseEnv = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
