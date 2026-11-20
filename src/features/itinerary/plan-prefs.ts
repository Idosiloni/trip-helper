"use client";

import { useSyncExternalStore } from "react";

// How each person likes to read the plan: as a table, cards or a flowing document,
// and with or without exact times. Kept on this device only (a convenience, not trip data).

export type PlanView = "table" | "cards" | "story";
export type PlanPrefs = { view: PlanView; times: boolean };

const KEY = "plan-prefs";
const DEFAULTS: PlanPrefs = { view: "table", times: false };
const listeners = new Set<() => void>();
let cached: PlanPrefs | null = null;

function read(): PlanPrefs {
  if (cached) return cached;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<PlanPrefs>;
    cached = {
      view: raw.view === "cards" || raw.view === "story" || raw.view === "table" ? raw.view : DEFAULTS.view,
      times: typeof raw.times === "boolean" ? raw.times : DEFAULTS.times,
    };
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export function setPlanPrefs(patch: Partial<PlanPrefs>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // private mode: the choice lasts until the page reloads
  }
  listeners.forEach((l) => l());
}

export function usePlanPrefs(): PlanPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULTS,
  );
}
