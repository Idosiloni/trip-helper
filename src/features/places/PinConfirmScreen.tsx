"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { showToast } from "@/components/ui/Toast";
import { googleMapsSearchUrl, type GeoResult } from "@/lib/geo";
import { LazyMap } from "../map/LazyMap";
import { NO_POINTS } from "../map/points";
import { live } from "../lists/helpers";
import { patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Place } from "../trip-data/types";
import { geocode } from "./api";
import { countryFor, needsPin } from "./helpers";

/**
 * Confirm pins one place at a time (SPEC 8.2). Each place is looked up only
 * when it's on screen — one request per place, never in bulk — and the user
 * confirms, moves the pin, or marks it "not found" (kept with a Google search link).
 */
export function PinConfirmScreen() {
  const t = useTranslations("places");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const base = `/trips/${snap.trip!.id}/places`;
  const queue = live(snap.places).filter(needsPin);
  const [skipped, setSkipped] = useState<string[]>([]);
  const current: Place | undefined = queue.find((p) => !skipped.includes(p.id));
  const [lookup, setLookup] = useState<{ id: string; results: GeoResult[] } | null>(null);
  const [override, setPick] = useState<{ id: string; lat: number; lng: number; label: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const total = queue.length;

  // A "found" place already has a guess; a "pending" one needs exactly one lookup.
  const hasGuess = current ? current.lat !== null && current.lng !== null : false;
  const currentId = current?.id;
  useEffect(() => {
    if (!current || hasGuess || lookup?.id === current.id) return;
    let cancelled = false;
    geocode(current.name, current.city, countryFor(snap, current.city))
      .then((results) => !cancelled && setLookup({ id: current.id, results }))
      .catch(() => !cancelled && setLookup({ id: current.id, results: [] }));
    return () => {
      cancelled = true;
    };
    // Look up once per place, not on every live update of the trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, hasGuess, lookup?.id]);

  // The pin shown: the user's move/choice, else the stored guess, else the first result.
  const first = lookup && lookup.id === currentId ? lookup.results[0] : undefined;
  const pick =
    override && override.id === currentId
      ? override
      : current && hasGuess
        ? { lat: current.lat!, lng: current.lng!, label: current.geocode_label }
        : first
          ? { lat: first.lat, lng: first.lng, label: first.label }
          : null;

  async function save(patch: Partial<Place>) {
    if (!current) return;
    setBusy(true);
    try {
      await patchRow(store, "places", current.id, patch);
      setLookup(null);
      setPick(null);
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  if (!canEdit) return <p className="py-8">{t("viewerCantConfirm")}</p>;

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader title={t("confirmTitle")} backHref={base} backLabel={tc("back")} />
        <EmptyState icon="pin" title={t("allConfirmed")} action={<Link href={base} className="font-bold underline underline-offset-4">{t("toPlaces")}</Link>} />
      </div>
    );
  }

  const loading = !hasGuess && lookup?.id !== current.id;
  const done = total - queue.filter((p) => !skipped.includes(p.id)).length + 1;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("confirmTitle")} backHref={base} backLabel={tc("back")} />
      <p className="text-sm font-extrabold">{t("confirmProgress", { n: done, total })}</p>
      <div>
        <p className="display text-[2.6rem]">{current.name}</p>
        <p className="text-ink-2">{[current.area, current.city].filter(Boolean).join(", ")}</p>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse border-2 border-ink bg-surface-2" aria-busy="true" />
      ) : pick ? (
        <>
          <LazyMap label={t("pinMap")} className="h-64" points={NO_POINTS} draggable={{ lat: pick.lat, lng: pick.lng, onMove: (lat, lng) => setPick({ id: current.id, lat, lng, label: pick.label }) }} />
          {pick.label ? <p className="text-sm text-ink-2" dir="auto">{pick.label}</p> : null}
          {lookup && lookup.results.length > 1 ? (
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer font-bold">{t("otherResults", { n: lookup.results.length - 1 })}</summary>
              <ul>
                {lookup.results.map((r, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setPick({ id: current.id, lat: r.lat, lng: r.lng, label: r.label })} className="min-h-11 w-full border-b border-hair text-start" dir="auto">
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <Button size="lg" block loading={busy} onClick={() => save({ lat: pick.lat, lng: pick.lng, geocode_label: pick.label, geocode_status: "confirmed" })}>
            {t("pinCorrect")}
          </Button>
        </>
      ) : (
        <p className="border-2 border-dashed border-ink p-3">{t("noResults")}</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => save({ geocode_status: "not_found", lat: null, lng: null, geocode_label: null })}>
          {t("notFound")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => setSkipped([...skipped, current.id])}>
          {tc("skip")}
        </Button>
      </div>
      <a href={googleMapsSearchUrl(current)} target="_blank" rel="noopener noreferrer" className="min-h-11 self-start font-bold underline underline-offset-4">
        {t("checkInGoogle")}
      </a>
    </div>
  );
}
