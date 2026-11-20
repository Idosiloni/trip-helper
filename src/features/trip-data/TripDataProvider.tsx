"use client";

import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { TripStore } from "./store";
import type { TripSnapshot } from "./types";

const StoreContext = createContext<TripStore | null>(null);

export function TripDataProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  // One store per trip id; created lazily so it's stable across renders.
  const [store] = useState(() => new TripStore(tripId));
  useEffect(() => {
    void store.start();
    return () => store.dispose();
  }, [store]);
  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useTripStore(): TripStore {
  const store = use(StoreContext);
  if (!store) throw new Error("useTripStore must be used inside TripDataProvider");
  return store;
}

export function useTripData(): TripSnapshot {
  const store = useTripStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** The trip row; only call below TripShell's ready gate. */
export function useTripRow() {
  const trip = useTripData().trip;
  if (!trip) throw new Error("trip not loaded");
  return trip;
}

/** Can the current user edit (owner/editor)? */
export function useCanEdit(): boolean {
  const role = useTripData().me.role;
  return role === "owner" || role === "editor";
}
