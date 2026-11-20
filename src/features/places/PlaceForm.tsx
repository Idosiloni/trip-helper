"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { isShortMapsLink, parseGoogleMapsLink, type GeoResult } from "@/lib/geo";
import { keyAfter } from "@/lib/position";
import { PLACE_CATEGORIES } from "@/lib/tripdata/schemas";
import { LazyMap } from "../map/LazyMap";
import { NO_POINTS } from "../map/points";
import { insertRow, patchRow } from "../trip-data/mutations";
import { useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Place } from "../trip-data/types";
import { live } from "../lists/helpers";
import { geocode } from "./api";
import { countryFor, profileCities } from "./helpers";

type Draft = {
  name: string;
  category: Place["category"];
  city: string;
  area: string;
  hours: string;
  mapsUrl: string;
  point: { lat: number; lng: number; label: string | null; status: Place["geocode_status"] } | null;
};

const toDraft = (p: Place | null): Draft => ({
  name: p?.name ?? "",
  category: p?.category ?? "attraction",
  city: p?.city ?? "",
  area: p?.area ?? "",
  hours: p?.hours_text ?? "",
  mapsUrl: p?.maps_url ?? "",
  point: p && p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng, label: p.geocode_label, status: p.geocode_status } : null,
});

/** Locate a place: search (on tap only), pick a result, drag to fine-tune; or paste a Google Maps link. */
export function LocationPicker({ draft, setDraft, country }: { draft: Draft; setDraft: (d: Draft) => void; country: string | null }) {
  const t = useTranslations("places");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GeoResult[] | null>(null);

  async function search() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      const r = await geocode(draft.name.trim(), draft.city.trim() || null, country);
      setResults(r);
      if (r[0]) setDraft({ ...draft, point: { lat: r[0].lat, lng: r[0].lng, label: r[0].label, status: "found" } });
    } catch {
      showToast({ message: t("geocodeFailed") });
    }
    setBusy(false);
  }

  function fromLink(url: string) {
    const p = parseGoogleMapsLink(url);
    if (p) setDraft({ ...draft, mapsUrl: url, point: { ...p, label: null, status: "manual" } });
    else setDraft({ ...draft, mapsUrl: url });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" loading={busy} disabled={!draft.name.trim()} onClick={search} icon={<Icon name="pin" size={18} />}>
        {t("findLocation")}
      </Button>
      {results && results.length === 0 ? <p className="text-sm text-ink-2">{t("noResults")}</p> : null}
      {results && results.length > 1 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-bold">{t("chooseResult")}</legend>
          {results.map((r, i) => (
            <label key={i} className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-hair text-sm">
              <input
                type="radio"
                name="geo"
                checked={draft.point?.lat === r.lat && draft.point?.lng === r.lng}
                onChange={() => setDraft({ ...draft, point: { lat: r.lat, lng: r.lng, label: r.label, status: "found" } })}
                className="size-5 accent-[var(--ink)]"
              />
              <span dir="auto">{r.label}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {draft.point ? (
        <>
          <LazyMap
            label={t("pinMap")}
            className="h-56"
            points={NO_POINTS}
            draggable={{ lat: draft.point.lat, lng: draft.point.lng, onMove: (lat, lng) => setDraft({ ...draft, point: { lat, lng, label: draft.point!.label, status: "manual" } }) }}
          />
          <p className="text-sm text-ink-2">{t("dragHint")}</p>
        </>
      ) : null}
      <TextField
        label={t("mapsLink")}
        hint={draft.mapsUrl && isShortMapsLink(draft.mapsUrl) ? t("shortLinkHint") : t("mapsLinkHint")}
        dir="ltr"
        inputMode="url"
        value={draft.mapsUrl}
        onChange={(e) => fromLink(e.target.value)}
      />
    </div>
  );
}

export function PlaceForm({ place, open, onClose, defaultCity }: { place: Place | null; open: boolean; onClose: () => void; defaultCity?: string }) {
  const t = useTranslations("places");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const d = draft ?? { ...toDraft(place), city: place?.city ?? defaultCity ?? "" };
  const [busy, setBusy] = useState(false);
  const cities = profileCities(snap);

  function close() {
    setDraft(null);
    onClose();
  }

  async function save() {
    const name = d.name.trim();
    if (!name) return;
    const url = d.mapsUrl.trim();
    const values = {
      name,
      category: d.category,
      city: d.city.trim() || null,
      area: d.area.trim() || null,
      hours_text: d.hours.trim() || null,
      maps_url: /^https:\/\/\S+$/i.test(url) ? url : null,
      lat: d.point?.lat ?? null,
      lng: d.point?.lng ?? null,
      geocode_label: d.point?.label ?? null,
      // A pin the user saw on the map (picked or dragged) counts as confirmed.
      geocode_status: d.point ? (d.point.status === "manual" ? "manual" : "confirmed") : place?.geocode_status === "not_found" ? "not_found" : "pending",
    } as const;
    setBusy(true);
    try {
      if (place) await patchRow(store, "places", place.id, values);
      else await insertRow(store, "places", { ...values, position: keyAfter(live(snap.places).at(-1)?.position) });
      close();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={close} title={place ? t("editPlace") : t("addPlace")} closeLabel={tc("close")} side>
      <div className="flex flex-col gap-4">
        <TextField label={t("name")} hint={t("nameHint")} value={d.name} maxLength={120} onChange={(e) => setDraft({ ...d, name: e.target.value })} />
        <Select label={t("category")} value={d.category} onChange={(e) => setDraft({ ...d, category: e.target.value as Place["category"] })} options={PLACE_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("city")} list="trip-cities" value={d.city} maxLength={60} onChange={(e) => setDraft({ ...d, city: e.target.value })} />
          <TextField label={t("area")} value={d.area} maxLength={60} onChange={(e) => setDraft({ ...d, area: e.target.value })} />
          <datalist id="trip-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <TextField label={t("hours")} value={d.hours} maxLength={200} onChange={(e) => setDraft({ ...d, hours: e.target.value })} />
        <LocationPicker draft={d} setDraft={setDraft} country={countryFor(snap, d.city || null)} />
        <Button size="lg" block loading={busy} disabled={!d.name.trim()} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </Sheet>
  );
}
