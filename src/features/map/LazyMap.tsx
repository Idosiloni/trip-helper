"use client";

import dynamic from "next/dynamic";

/** The map, loaded only when a screen actually shows one (keeps MapLibre out of other bundles). */
export const LazyMap = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => <div className="h-[60dvh] w-full animate-pulse border-2 border-ink bg-surface-2" />,
});
