"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { patchRow } from "../trip-data/mutations";
import { useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { geocode } from "./api";
import { countryFor, needsPin } from "./helpers";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The run lives outside the component, so moving around the app doesn't stop it or start a second one.
type Progress = { done: number; total: number; missed: number } | null;
let job: Progress = null;
const listeners = new Set<() => void>();
const setJob = (p: Progress) => {
  job = p;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * "Find them all": every place still waiting for a pin gets the geocoder's first
 * result, one a second (the free geocoder's rule). Any pin can be fixed later on
 * the place itself; the one-by-one screen stays for whoever wants to check.
 */
export function AutoLocate({ base }: { base: string }) {
  const t = useTranslations("places");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const progress = useSyncExternalStore(subscribe, () => job, () => null);
  const pending = snap.places.filter(needsPin);
  if (!pending.length && !progress) return null;

  async function run() {
    if (job) return;
    const list = store.getSnapshot().places.filter(needsPin);
    let missed = 0;
    setJob({ done: 0, total: list.length, missed });
    for (const [i, p] of list.entries()) {
      try {
        if (p.lat !== null && p.lng !== null) {
          await patchRow(store, "places", p.id, { geocode_status: "confirmed" });
        } else {
          const started = Date.now();
          const [first] = await geocode(p.name, p.city, countryFor(store.getSnapshot(), p.city));
          if (first) await patchRow(store, "places", p.id, { lat: first.lat, lng: first.lng, geocode_label: first.label?.slice(0, 300) ?? null, geocode_status: "confirmed" });
          else {
            // Not on the map (often an activity, not a place: "lunch nearby", a train). Stop asking about it.
            missed++;
            await patchRow(store, "places", p.id, { geocode_status: "not_found" });
          }
          // At most one lookup a second (the free geocoder's rule).
          await wait(Math.max(0, 1100 - (Date.now() - started)));
        }
      } catch {
        missed++;
      }
      setJob({ done: i + 1, total: list.length, missed });
    }
    showToast({ message: missed ? t("autoDoneMissed", { n: list.length - missed, missed }) : t("autoDone", { n: list.length }) });
    setJob(null);
  }

  return (
    <div className="flex flex-col gap-2 border-2 border-ink bg-surface p-3">
      <p className="flex items-center gap-2 font-bold">
        <Icon name="pin" size={18} className="text-trip-ink" />
        {progress ? t("autoProgress", { done: progress.done, total: progress.total }) : t("pendingPins", { n: pending.length })}
      </p>
      {progress ? (
        <div className="h-2 w-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
          <div className="h-full bg-trip transition-[width]" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={() => void run().catch(() => showToast({ message: tc("errorGeneric") }))} className="flex min-h-11 items-center gap-1.5 bg-ink px-3 text-sm font-extrabold text-on-ink">
            {t("autoLocate")}
          </button>
          <Link href={`${base}/confirm`} className="min-h-11 content-center text-sm font-bold underline underline-offset-4">
            {t("oneByOne")}
          </Link>
        </div>
      )}
      <p className="text-xs text-ink-2">{progress ? t("autoRunningHint") : t("autoHint")}</p>
    </div>
  );
}
