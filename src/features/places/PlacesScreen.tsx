"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/components/ui/cn";
import { showToast } from "@/components/ui/Toast";
import { distanceKm, googleMapsDirectionsUrl } from "@/lib/geo";
import { useToday } from "@/lib/use-today";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/tripdata/schemas";
import { dayCity } from "../itinerary/helpers";
import { patchRow } from "../trip-data/mutations";
import { CATEGORY_COLORS } from "../map/colors";
import { live } from "../lists/helpers";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Place } from "../trip-data/types";
import { isTransportPlace, located, primaryCity, profileCities } from "./helpers";
import { PlaceForm } from "./PlaceForm";
import { PlaceSheet } from "./PlaceSheet";
import { useNearMe } from "./useNearMe";
import { AutoLocate } from "./AutoLocate";

type StatusFilter = "want" | "visited" | "all";
const ALL = "__all";
const NONE = "__none";

export function distanceText(d: number): string {
  return d < 1 ? `${Math.max(50, Math.round((d * 1000) / 50) * 50)} מ׳` : d < 10 ? `${d.toFixed(1)} ק״מ` : `${Math.round(d)} ק״מ`;
}

export function PlacesScreen() {
  const t = useTranslations("places");
  const tg = useTranslations("gmaps");
  const tk = useTranslations("kml");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const params = useSearchParams();
  const today = useToday();
  const trip = snap.trip!;
  const base = `/trips/${trip.id}/places`;
  const near = useNearMe();

  // Flights and trains a full-plan paste saved as places: hidden unless asked for.
  const [withTransport, setWithTransport] = useState(false);
  const allLive = useMemo(() => live(snap.places), [snap.places]);
  const transportCount = allLive.filter(isTransportPlace).length;
  const places = useMemo(() => (withTransport ? allLive : allLive.filter((p) => !isTransportPlace(p))), [allLive, withTransport]);
  const cityOf = (p: Place) => primaryCity(p.city);
  // Cities in trip order, one chip each; during the trip, start on today's city.
  const cities = useMemo(() => {
    const order = profileCities(snap);
    for (const p of places) {
      const c = primaryCity(p.city);
      if (c && !order.includes(c)) order.push(c);
    }
    return order.filter((c) => places.some((p) => primaryCity(p.city) === c));
  }, [snap, places]);
  const todayDay = today ? snap.days.find((d) => d.date === today) : undefined;
  const todayCity = todayDay ? primaryCity(dayCity(snap, todayDay)) : null;
  // null = automatic (today's city during the trip, otherwise all).
  const [picked, setCity] = useState<string | null>(null);
  const hasUnfiled = places.some((p) => !cityOf(p));
  const city = picked && (picked === ALL || cities.includes(picked) || (picked === NONE && hasUnfiled)) ? picked : todayCity && cities.includes(todayCity) ? todayCity : ALL;
  const [status, setStatus] = useState<StatusFilter>("want");
  const [cats, setCats] = useState<PlaceCategory[]>([]);
  const [mustOnly, setMustOnly] = useState(params.get("filter") === "must");
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Where each place sits in the plan ("יום 3"), from its first scheduled stop.
  const planDay = useMemo(() => {
    const m = new Map<string, number>();
    const dayNo = new Map(snap.days.map((d, i) => [d.id, i + 1]));
    for (const st of snap.stops) {
      if (st.deleted_at || !st.place_id || !st.day_id) continue;
      const n = dayNo.get(st.day_id);
      if (n && (!m.has(st.place_id) || n < m.get(st.place_id)!)) m.set(st.place_id, n);
    }
    return m;
  }, [snap.stops, snap.days]);

  const inCityOf = (c: string) => (p: Place) => c === ALL || (c === NONE ? !cityOf(p) : cityOf(p) === c);
  const inCity = places.filter(inCityOf(city));
  const counts = { want: inCity.filter((p) => p.status === "want").length, visited: inCity.filter((p) => p.status === "visited").length, all: inCity.length };
  const dist = (p: Place) => (near.pos && located(p) ? distanceKm(near.pos, p) : null);
  // One filter for the list, the city chips and the section headers, so their counts always agree.
  const matches = (p: Place) =>
    (status === "all" || p.status === status) &&
    (!cats.length || cats.includes(p.category)) &&
    (!mustOnly || p.priority === "must") &&
    (!q || [p.name, p.city, p.area, p.notes].some((v) => v?.toLowerCase().includes(q)));
  const shown = inCity
    .filter(matches)
    .sort((a, b) => {
      if (near.pos) return (dist(a) ?? 1e9) - (dist(b) ?? 1e9);
      return Number(b.priority === "must") - Number(a.priority === "must") || (planDay.get(a.id) ?? 99) - (planDay.get(b.id) ?? 99);
    });

  // Near me: one list by distance. Otherwise grouped by city (all cities) or by area (one city).
  const groups = new Map<string, Place[]>();
  if (near.pos) groups.set("", shown);
  else
    for (const p of shown) {
      const k = city === ALL ? (cityOf(p) ?? t("noCity")) : (p.area ?? "");
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    if (city !== ALL) return a === "" ? 1 : b === "" ? -1 : 0;
    const ia = cities.indexOf(a);
    const ib = cities.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  async function toggleVisited(p: Place) {
    await patchRow(store, "places", p.id, { status: p.status === "visited" ? "want" : "visited" }).catch(() => showToast({ message: tc("errorGeneric") }));
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="display print-offset text-[3.5rem]">{t("title")}</h2>

      {canEdit ? <AutoLocate base={base} /> : null}

      {places.length === 0 ? (
        <>
          <EmptyState icon="pin" title={t("emptyTitle")} body={t("emptyBody")} />
          {canEdit ? (
            <Link href={`${base}/import-gmaps`} className="flex min-h-14 items-center justify-center gap-2 bg-ink px-4 text-lg font-extrabold text-on-ink">
              <Icon name="pin" size={18} />
              {tg("button")}
            </Link>
          ) : null}
        </>
      ) : (
        <>
          {cities.length > 1 || (cities.length && hasUnfiled) ? (
            <div role="group" aria-label={t("cityFilter")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {[ALL, ...cities, ...(hasUnfiled ? [NONE] : [])].map((c) => {
                const on = city === c;
                const n = places.filter((p) => inCityOf(c)(p) && matches(p)).length;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCity(c)}
                    className={cn("flex min-h-11 shrink-0 items-center gap-1.5 border-2 border-ink px-3 font-bold", on ? "bg-ink text-on-ink shadow-[3px_3px_0_0_var(--trip)]" : "bg-surface")}
                  >
                    {c === ALL ? t("allCities") : c === NONE ? t("noCity") : c}
                    {c === todayCity ? <span className="text-xs font-extrabold text-trip-ink">{t("todayHere")}</span> : null}
                    <span className={cn("text-xs tabular-nums", on ? "text-on-ink" : "text-ink-2")}>{n}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex gap-2">
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 border-2 border-ink bg-surface px-3 focus-within:border-focus">
              <Icon name="search" size={18} className="text-ink-2" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} className="min-w-0 flex-1 bg-transparent text-lg outline-none" />
            </label>
            <button
              type="button"
              aria-pressed={Boolean(near.pos)}
              onClick={near.toggle}
              className={cn("flex min-h-12 shrink-0 items-center gap-1.5 border-2 border-ink px-3 font-bold", near.pos ? "bg-ink text-on-ink" : "bg-surface")}
            >
              <Icon name="navigate" size={16} />
              {near.status === "asking" ? t("locating") : t("nearMe")}
            </button>
          </div>
          {near.status === "denied" ? <p className="text-sm font-bold">{t("locationDenied")}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t("show")} className="flex border-2 border-ink">
              {(["want", "visited", "all"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={status === k}
                  onClick={() => setStatus(k)}
                  className={cn("flex min-h-10 items-center gap-1 border-e-2 border-ink px-2.5 text-sm font-bold last:border-e-0", status === k ? "bg-ink text-on-ink" : "bg-surface")}
                >
                  {k === "all" ? t("all") : t(`statuses.${k}`)}
                  <span className="tabular-nums opacity-70">{counts[k]}</span>
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={mustOnly} onClick={() => setMustOnly(!mustOnly)} className={cn("flex min-h-10 items-center gap-1 border-2 border-ink px-2.5 text-sm font-bold", mustOnly ? "bg-ink text-on-ink" : "bg-surface")}>
              <Icon name="star" size={14} />
              {t("mustOnly")}
            </button>
          </div>
          <div role="group" aria-label={t("categoriesLabel")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
            {PLACE_CATEGORIES.filter((c) => places.some((p) => p.category === c)).map((c) => {
              const on = cats.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCats(on ? cats.filter((x) => x !== c) : [...cats, c])}
                  className={cn("flex min-h-9 shrink-0 items-center gap-1.5 border-2 px-2.5 text-sm font-bold", on ? "border-ink bg-ink text-on-ink" : "border-hair bg-surface")}
                >
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
                  {t(`categories.${c}`)}
                </button>
              );
            })}
          </div>

          {transportCount ? (
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink-2">
              <input type="checkbox" checked={withTransport} onChange={(e) => setWithTransport(e.target.checked)} className="size-5 accent-ink" />
              {t("showTransport", { n: transportCount })}
            </label>
          ) : null}

          <div className="flex flex-col gap-4">
            {groupKeys.map((g) => (
              <section key={g || "_"} className="flex flex-col gap-2">
                {g || groupKeys.length > 1 ? (
                  <h3 className="flex items-baseline gap-2 border-b-2 border-ink pb-1">
                    <span className="text-lg font-extrabold">{g || (city === ALL ? t("noCity") : t("noArea"))}</span>
                    <span className="text-sm font-bold text-ink-2">{groups.get(g)!.length}</span>
                  </h3>
                ) : null}
                <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 xl:grid-cols-3">
                  {groups.get(g)!.map((p) => (
                    <PlaceRow key={p.id} place={p} day={planDay.get(p.id)} distance={dist(p)} showCity={Boolean(near.pos) && city === ALL} onOpen={() => setOpenId(p.id)} onVisited={() => void toggleVisited(p)} />
                  ))}
                </ul>
              </section>
            ))}
            {shown.length === 0 ? <p className="py-6 text-center text-ink-2">{t("noneInFilter")}</p> : null}
          </div>
        </>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-2 border-t-2 border-dashed border-ink pt-4">
          <Button variant="secondary" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => setAdding(true)}>
            {t("addPlace")}
          </Button>
          {places.length ? (
            <Link href={`${base}/import-gmaps`} className="flex min-h-12 items-center justify-center gap-2 border-2 border-ink bg-surface font-bold">
              <Icon name="pin" size={16} />
              {tg("button")}
            </Link>
          ) : null}
          <Link href={`${base}/import-kml`} className="flex min-h-11 items-center justify-center gap-2 text-sm font-bold text-ink-2 underline underline-offset-4">
            {tk("button")}
          </Link>
        </div>
      ) : null}

      <PlaceSheet placeId={openId} onClose={() => setOpenId(null)} />
      <PlaceForm place={null} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function PlaceRow({ place: p, day, distance, showCity, onOpen, onVisited }: { place: Place; day?: number; distance: number | null; showCity: boolean; onOpen: () => void; onVisited: () => void }) {
  const t = useTranslations("places");
  return (
    <li className={cn("flex items-stretch border-2 border-ink bg-surface shadow-[2px_2px_0_0_var(--trip-tint)]", p.status === "skipped" && "opacity-60")}>
      <span aria-hidden="true" className="w-2 shrink-0" style={{ background: CATEGORY_COLORS[p.category] }} />
      <button type="button" onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-start">
        <span className="flex items-center gap-2">
          <span className={cn("truncate text-[17px] font-bold", p.status === "skipped" && "line-through", p.status === "visited" && "text-ink-2")}>{p.name}</span>
          {p.priority === "must" ? (
            <>
              <Icon name="star" size={15} aria-hidden="true" className="shrink-0 text-trip-ink" />
              <span className="sr-only">{t("must")}</span>
            </>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
          {distance !== null ? (
            <span dir="rtl" className="font-extrabold text-ink">
              {distanceText(distance)}
            </span>
          ) : null}
          <span className="font-bold" style={{ color: CATEGORY_COLORS[p.category] }}>
            {t(`categories.${p.category}`)}
          </span>
          {showCity && p.city ? <span>{primaryCity(p.city)}</span> : null}
          {p.area ? <span>{p.area}</span> : null}
          {day ? <span className="border border-ink px-1 font-bold text-ink">{t("inPlanDay", { n: day })}</span> : null}
          {p.rating ? (
            <span className="text-trip-ink">
              <span aria-hidden="true">{"★".repeat(p.rating)}</span>
              <span className="sr-only">{t("stars", { n: p.rating })}</span>
            </span>
          ) : null}
          {p.notes ? <span className="max-w-full truncate">{p.notes}</span> : null}
        </span>
      </button>
      <a href={googleMapsDirectionsUrl(p)} target="_blank" rel="noopener noreferrer" aria-label={t("navigateTo", { name: p.name })} className="grid w-11 shrink-0 place-items-center border-s border-hair">
        <Icon name="navigate" size={18} />
      </a>
      <button
        type="button"
        aria-pressed={p.status === "visited"}
        aria-label={p.status === "visited" ? t("statuses.visited") : t("markVisited")}
        onClick={onVisited}
        className={cn("grid w-11 shrink-0 place-items-center border-s border-hair", p.status === "visited" && "bg-ink text-on-ink")}
      >
        <Icon name="check" size={18} strokeWidth={3} />
      </button>
    </li>
  );
}
