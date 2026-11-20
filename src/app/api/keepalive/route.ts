import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/keepalive — called daily by Vercel Cron (vercel.json).
 * Supabase pauses free projects after about a week with no requests (SPEC §19),
 * so this makes one tiny anonymous request. RLS returns nothing; it leaks nothing.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, reason: "not configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from("trips").select("id").limit(1);
  return NextResponse.json({ ok: !error, at: new Date().toISOString() }, { status: error ? 502 : 200 });
}
