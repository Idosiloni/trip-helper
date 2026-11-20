import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, hasSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookie on every matched request and reports
 * whether a user is signed in. getClaims() must run before the response is
 * built, or refreshed cookies are lost (see @supabase/ssr setAll docs).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv) {
    return { response, userId: null as string | null, configured: false };
  }

  const client = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await client.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  return { response, userId, configured: true };
}
