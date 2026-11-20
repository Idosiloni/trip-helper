import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = ["/login", "/join", "/dev", "/api", "/auth"]; // API routes check auth themselves

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, userId, configured } = await updateSession(request);

  // Without Supabase env vars, let pages render their own setup notice.
  if (!configured) return response;

  const redirectTo = (path: string) => {
    const r = NextResponse.redirect(new URL(path, request.url));
    // Keep any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // A password-reset link lands on the site root with ?code= (the only allowed redirect URL).
  if (pathname === "/" && request.nextUrl.searchParams.get("code")) {
    return redirectTo(`/auth/reset?code=${encodeURIComponent(request.nextUrl.searchParams.get("code")!)}`);
  }
  if (pathname === "/") return redirectTo(userId ? "/trips" : "/login");

  // /trips/:id opens on the "today" tab.
  const tripRoot = pathname.match(/^\/trips\/([0-9a-f-]{36})\/?$/i);
  if (tripRoot && userId) return redirectTo(`/trips/${tripRoot[1]}/today`);

  if (!userId && !isPublic(pathname)) {
    return redirectTo(`/login?next=${encodeURIComponent(pathname + search)}`);
  }

  if (userId && pathname === "/login") return redirectTo("/trips");

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, the manifest and static files.
    "/((?!_next/static|_next/image|manifest.webmanifest|sw.js|icons/|maplibre/|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs)$).*)",
  ],
};
