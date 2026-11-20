"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

// MapLibre + OpenFreeMap tiles (SPEC 8.1): free, keyless; attribution is added
// by MapLibre automatically. This file is only ever loaded via next/dynamic,
// so the ~800KB library stays out of every other screen.

import type { MapPoint } from "./points";
export type { MapPoint };

const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";

// Offline (SPEC §10): no tiles, just the points on a plain background. The
// points are HTML markers, so they need no fonts or sprites from the network.
const offlineStyle = (dark: boolean) => ({
  version: 8 as const,
  sources: {},
  layers: [{ id: "bg", type: "background" as const, paint: { "background-color": dark ? "#24221f" : "#ebe5d8" } }],
});

function isDark(): boolean {
  const forced = document.documentElement.dataset.theme;
  if (forced) return forced === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function markerEl(p: MapPoint, onSelect?: (id: string) => void): HTMLElement {
  const el = document.createElement(onSelect ? "button" : "div");
  el.setAttribute("aria-label", p.title);
  if (onSelect) {
    (el as HTMLButtonElement).type = "button";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect(p.id);
    });
  }
  const size = p.selected ? 34 : p.label ? 28 : 22;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${p.color};border:3px solid #fffcf6;box-shadow:0 0 0 2px #1c1b19;color:#fffcf6;font:800 13px/1 var(--font-heebo),sans-serif;display:grid;place-items:center;cursor:${onSelect ? "pointer" : "default"};padding:0`;
  if (p.label) el.textContent = p.label;
  return el;
}

export default function TripMap({
  points,
  line,
  onSelect,
  draggable,
  className = "h-[60dvh]",
  label,
}: {
  points: MapPoint[];
  /** [lng, lat] in order, e.g. a day's stops. */
  line?: [number, number][];
  onSelect?: (id: string) => void;
  /** One draggable pin (confirming a place's location). */
  draggable?: { lat: number; lng: number; onMove: (lat: number, lng: number) => void };
  className?: string;
  /** Accessible name for the map region. */
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<MlMarker[]>([]);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const onMoveRef = useRef(draggable?.onMove);
  useEffect(() => {
    onMoveRef.current = draggable?.onMove;
  });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      // Served from public/ (see scripts/copy-maplibre-worker.mjs).
      if (!ml.getWorkerUrl()?.startsWith("/maplibre/")) ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      lib.current = ml;
      const first = draggable ?? points[0];
      const m = new ml.Map({
        container: box.current,
        style: navigator.onLine === false ? offlineStyle(isDark()) : isDark() ? STYLE_DARK : STYLE_LIGHT,
        center: first ? [first.lng, first.lat] : [139.76, 35.68],
        zoom: first ? 13 : 2,
        attributionControl: { compact: true },
      });
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
      m.on("load", () => !cancelled && setReady(true));
      map.current = m;
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers, line and framing follow the props.
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    for (const p of points) {
      markers.current.push(new ml.Marker({ element: markerEl(p, onSelect) }).setLngLat([p.lng, p.lat]).addTo(m));
    }
    if (draggable) {
      const pin = new ml.Marker({ draggable: true, color: "#b8322a" }).setLngLat([draggable.lng, draggable.lat]).addTo(m);
      pin.on("dragend", () => {
        const { lat, lng } = pin.getLngLat();
        onMoveRef.current?.(lat, lng);
      });
      markers.current.push(pin);
    }

    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line ?? [] } };
    const src = m.getSource("route") as import("maplibre-gl").GeoJSONSource | undefined;
    if (src) src.setData(data);
    else if (line && line.length > 1) {
      m.addSource("route", { type: "geojson", data });
      m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#1c1b19", "line-width": 3, "line-dasharray": [2, 1.5] } });
    }

    const all: [number, number][] = [...points.map((p) => [p.lng, p.lat] as [number, number]), ...(draggable ? [[draggable.lng, draggable.lat] as [number, number]] : [])];
    if (all.length === 1) m.jumpTo({ center: all[0], zoom: Math.max(m.getZoom(), 14) });
    else if (all.length > 1) {
      const b = all.reduce((acc, c) => acc.extend(c), new ml.LngLatBounds(all[0], all[0]));
      m.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 });
    }
    // `draggable` is a fresh object each render; depend on its position only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, points, line, onSelect, draggable?.lat, draggable?.lng]);

  return <div ref={box} role="region" aria-label={label} className={`relative w-full overflow-hidden border-2 border-ink bg-surface-2 ${className}`} />;
}

