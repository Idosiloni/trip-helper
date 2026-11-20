"use client";

import { useEffect, useRef } from "react";
import type { TripSnapshot } from "../trip-data/types";
import { patchProfile } from "./api";
import { planCities, profileUpdateFromPlan } from "./profile-sync";
import { parseTripProfile } from "@/lib/trip-profile";

/**
 * Keeps the trip profile's destinations in step with the plan: when a day gets
 * a city the profile doesn't know (an imported route, a city typed on a day),
 * the city is added with its dates. Editors only; online only; silent (a
 * profile change makes no activity row or notification).
 */
export function useProfileSync(snap: TripSnapshot, canEdit: boolean) {
  const ready = snap.status === "ready" && snap.live && canEdit && snap.trip;
  // Re-check whenever the plan's stays or the profile change.
  const key = ready ? JSON.stringify([planCities(snap), parseTripProfile(snap.trip!.profile).destinations]) : "";
  const tried = useRef(new Set<string>());
  const latest = useRef(snap);
  useEffect(() => {
    latest.current = snap;
  });
  useEffect(() => {
    if (!key || tried.current.has(key)) return;
    tried.current.add(key);
    const s = latest.current;
    void profileUpdateFromPlan(s)
      .then((destinations) => (destinations ? patchProfile(s.trip!.id, { destinations }) : null))
      .catch((e) => console.error("profile sync failed", e));
  }, [key]);
}
