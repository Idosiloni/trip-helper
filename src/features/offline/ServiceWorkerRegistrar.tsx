"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "./sw";

/** Registers the service worker on app load (production), so the app opens offline. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    // After load, so it never competes with the first paint.
    const go = () => void registerServiceWorker();
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
