"use client";

import { useState } from "react";

type State = { status: "off" | "asking" | "on" | "denied"; pos: { lat: number; lng: number } | null };

/** "Near me": asks for the location once per tap (nothing is stored or sent anywhere). */
export function useNearMe() {
  const [s, setS] = useState<State>({ status: "off", pos: null });
  function toggle() {
    if (s.pos) return setS({ status: "off", pos: null });
    if (!("geolocation" in navigator)) return setS({ status: "denied", pos: null });
    setS({ status: "asking", pos: null });
    navigator.geolocation.getCurrentPosition(
      (p) => setS({ status: "on", pos: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => setS({ status: "denied", pos: null }),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  }
  return { ...s, toggle };
}
