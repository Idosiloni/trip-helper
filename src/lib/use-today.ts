"use client";

import { useSyncExternalStore } from "react";
import { todayIn } from "./dates";

// "Simulated date" (settings): shows the app as if today were another day, to check the
// trip-day screens before the trip. Display only, on this device; no trip data changes.
const FAKE_KEY = "fake-today";
const listeners = new Set<() => void>();

export function fakeToday(): string | null {
  try {
    const v = localStorage.getItem(FAKE_KEY);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function setFakeToday(date: string | null) {
  try {
    if (date) localStorage.setItem(FAKE_KEY, date);
    else localStorage.removeItem(FAKE_KEY);
  } catch {}
  listeners.forEach((l) => l());
}

/** Now, shifted by whole days when a simulated date is on (the time of day stays real). */
export function nowMs(): number {
  const fake = fakeToday();
  if (!fake) return Date.now();
  const real = todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return Date.now() + (Date.parse(fake) - Date.parse(real));
}

function subscribe(onChange: () => void) {
  // Re-check once a minute so "today" rolls over at midnight in a long-open PWA.
  const id = setInterval(onChange, 60_000);
  listeners.add(onChange);
  return () => {
    clearInterval(id);
    listeners.delete(onChange);
  };
}

/** Today's date (YYYY-MM-DD) in `timeZone`, or null while prerendering on the server. */
export function useToday(timeZone?: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => fakeToday() ?? todayIn(timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone),
    () => null,
  );
}

/** The simulated date, if one is on (for the banner that says so). */
export function useFakeToday(): string | null {
  return useSyncExternalStore(subscribe, fakeToday, () => null);
}
