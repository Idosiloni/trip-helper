// One place that registers the service worker (push + offline shell).
// In development the worker is registered with ?mode=dev and skips all caching,
// so the dev server never gets stale pages or chunks.

export function swUrl() {
  return process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?mode=dev";
}

export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(swUrl(), { scope: "/", updateViaCache: "none" }).catch(() => null);
}

/** Asks the worker to keep these screens on the device (best effort). */
export async function warmPages(urls: string[]) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || navigator.onLine === false) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  reg?.active?.postMessage({ type: "warm", urls });
}
