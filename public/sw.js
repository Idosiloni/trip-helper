// Service worker: push notifications (phase 2b) and the offline app shell
// (phase 3b, SPEC §10). Trip DATA offline lives in IndexedDB (lib/offline);
// this file only makes the app's pages and code open without a connection.
//
// Rules, kept narrow on purpose (a bad fetch handler breaks the app online too):
// - only same-origin GET; never Supabase, /api, /login, /join, /auth;
// - pages: network first, cache only when the network fails; only 200,
//   non-redirected responses are stored (a cached redirect to /login would trap the user);
// - /_next/static: cache first (file names are content hashes);
// - icons, map worker, fonts: cached, refreshed in the background.
// Bump VERSION to drop old caches. Rollback = ship a version without the fetch listener.

const VERSION = "v2";
const PAGES = `th-pages-${VERSION}`;
const STATIC = `th-static-${VERSION}`;
const ASSETS = `th-assets-${VERSION}`;
const KEEP = [PAGES, STATIC, ASSETS];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("th-") && !KEEP.includes(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  ),
);

const NEVER = [/^\/api\//, /^\/login/, /^\/join\//, /^\/auth\//, /^\/sw\.js$/];

function pageKey(url) {
  // One copy per path; query strings (?filter=mine) render the same shell.
  return new Request(new URL(url.pathname, url.origin).href);
}

async function cachePage(url, res) {
  if (res && res.ok && res.status === 200 && !res.redirected && res.type === "basic") {
    const cache = await caches.open(PAGES);
    await cache.put(pageKey(url), res.clone());
  }
  return res;
}

// A screen that was never stored gets a plain "no connection" page. Never another
// screen's HTML: its data request uses the current path, misses, and the page stays blank.
async function offlinePage(url) {
  const cache = await caches.open(PAGES);
  const hit = await cache.match(pageKey(url));
  if (hit) return hit;
  const trip = url.pathname.match(/^\/trips\/([0-9a-f-]{36})(\/|$)/i);
  const links = [
    trip && (await cache.match(new URL(`/trips/${trip[1]}/today`, url.origin).href)) ? `<a href="/trips/${trip[1]}/today">חזרה לטיול</a>` : "",
    (await cache.match(new URL("/trips", url.origin).href)) ? '<a href="/trips">כל הטיולים</a>' : "",
  ].filter(Boolean);
  return new Response(
    '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trip Helper</title>' +
      '<body style="font-family:system-ui;padding:2rem;background:#f4f0e8;color:#1c1b19;line-height:1.5"><h1>אין חיבור</h1><p>המסך הזה עוד לא נשמר במכשיר. כשיחזור החיבור הוא ייפתח כרגיל.</p>' +
      links.map((a) => `<p style="font-weight:700">${a}</p>`).join("") +
      "</body></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// A page's HTML here is only a shell: the screen itself arrives in a second
// request the HTML makes at once (`__NEXT_CLIENT_RESUME`: same path, ?_rsc=,
// headers rsc:1 + segment prefetch "/_full"). Without a stored copy of that
// response the page opens blank offline, so it is cached next to the page.
function isScreenData(req) {
  return req.headers.get("rsc") === "1" && req.headers.get("next-router-segment-prefetch") === "/_full";
}

function screenDataKey(url) {
  return new Request(new URL(url.pathname + "?th-screen", url.origin).href);
}

async function cacheScreenData(url, res) {
  if (res && res.ok && res.status === 200 && !res.redirected && res.type === "basic") {
    const cache = await caches.open(PAGES);
    await cache.put(screenDataKey(url), res.clone());
  }
  return res;
}

async function offlineScreenData(url) {
  const cache = await caches.open(PAGES);
  return (await cache.match(screenDataKey(url))) || Response.error();
}

/** Fetches and stores the screen data a page's HTML asks for (see isScreenData). */
async function warmScreenData(url, html) {
  const m = html.match(/__NEXT_CLIENT_RESUME=fetch\(location\.pathname\+'(\?[^']*)',\{credentials:'same-origin',headers:(\{[^}]*\})\}\)/);
  if (!m) return;
  let headers;
  try {
    headers = JSON.parse(m[2].replace(/'/g, '"'));
  } catch {
    return;
  }
  const res = await fetch(new URL(url.pathname + m[1], url.origin).href, { credentials: "same-origin", headers });
  await cacheScreenData(url, res);
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then(async (res) => {
      if (res.ok && res.type === "basic") await cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

// Registered as /sw.js?mode=dev by the dev server: push only, no caching.
const DEV = new URL(self.location.href).searchParams.get("mode") === "dev";

self.addEventListener("fetch", (event) => {
  if (DEV) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((r) => r.test(url.pathname))) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => cachePage(url, res)).catch(() => offlinePage(url)));
    return;
  }
  if (isScreenData(req)) {
    event.respondWith(fetch(req).then((res) => cacheScreenData(url, res)).catch(() => offlineScreenData(url)));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (/^\/(icons|maplibre)\//.test(url.pathname) || /\.(woff2?|png|svg|webmanifest)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
  }
  // Everything else (other RSC payloads, segment prefetches) goes to the network
  // untouched: when that fails, Next falls back to a full page load, served above.
});

/** The code a page needs (its /_next/static files), so it also boots offline. */
async function cacheChunks(html) {
  const cache = await caches.open(STATIC);
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
  for (const u of urls) {
    try {
      if (await cache.match(u)) continue;
      const res = await fetch(u);
      if (res.ok && res.type === "basic") await cache.put(u, res);
    } catch {
      // Best effort.
    }
  }
}

// The app asks to keep a trip's screens on the device when the trip opens.
self.addEventListener("message", (event) => {
  if (DEV) return;
  const msg = event.data;
  if (!msg || msg.type !== "warm" || !Array.isArray(msg.urls)) return;
  event.waitUntil(
    (async () => {
      for (const path of msg.urls.slice(0, 60)) {
        try {
          const url = new URL(path, self.location.origin);
          if (url.origin !== self.location.origin || NEVER.some((r) => r.test(url.pathname))) continue;
          const res = await fetch(url.href, { credentials: "same-origin", redirect: "follow" });
          await cachePage(url, res);
          if (res.ok && !res.redirected) {
            const html = await res.clone().text();
            await warmScreenData(url, html);
            await cacheChunks(html);
          }
        } catch {
          // Offline or failed: try again next time.
        }
      }
    })(),
  );
});

// ------------------------------------------------------------------ push (2b)
// Every push shows a notification, even if the payload can't be read:
// iOS cancels the subscription after pushes that show nothing.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Trip Helper";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag,
      renotify: Boolean(data.tag),
      dir: "rtl",
      lang: "he",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/trips" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/trips", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) return w.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
