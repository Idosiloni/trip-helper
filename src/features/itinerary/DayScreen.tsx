"use client";

/* The useMemos below keep the day map from re-fitting on every render. The React
   Compiler (not enabled in this build) can't preserve them, which this rule reports. */
/* eslint-disable react-hooks/preserve-manual-memoization */

import { usePlanPrefs } from "./plan-prefs";
import { Reorder, useDragControls } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Stamp } from "@/components/ui/Stamp";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { distanceKm, googleMapsDirectionsUrl, googleMapsRouteUrl } from "@/lib/geo";
import { keyBetween } from "@/lib/position";
import { CATEGORY_COLORS } from "../map/colors";
import { live } from "../lists/helpers";
import { PlaceSheet } from "../places/PlaceSheet";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { ChangePlanButton } from "./ChangePlanSheet";
import { ShareDay } from "./ShareDay";
import { LoadBar, TagChips } from "./DayExtras";
import { stopTags } from "./insights";
import { insertRow, patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Stop, TripDay } from "../trip-data/types";
import { BOOKING_ICON } from "./DaysScreen";
import { bookingsOnDay, bookingTime, dayCity, nightStay, shortDate, stopLabel, weekday } from "./helpers";
import { buildTimeline, nextStop, type TimelineItem } from "./timeline";
import { useTripWeather } from "../weather/useTripWeather";
import { WeatherChip } from "../weather/WeatherChip";
import { useToday } from "@/lib/use-today";
import { StopSheet } from "./StopSheet";

function DaySheet({ day, open, onClose }: { day: TripDay; open: boolean; onClose: () => void }) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const [title, setTitle] = useState(day.title ?? "");
  const [city, setCity] = useState(day.city ?? "");
  const [lodging, setLodging] = useState(day.lodging_place_id ?? "");
  const [notes, setNotes] = useState(day.notes ?? "");
  const [planB, setPlanB] = useState(day.plan_b ?? "");
  const [flexible, setFlexible] = useState(day.flexible);
  const places = live(snap.places);
  const lodgings = [...places.filter((p) => p.category === "lodging"), ...places.filter((p) => p.category !== "lodging")];

  async function save() {
    try {
      await patchRow(store, "days", day.id, {
        title: title.trim() || null,
        city: city.trim() || null,
        lodging_place_id: lodging || null,
        notes: notes.trim() || null,
        plan_b: planB.trim() || null,
        flexible,
      });
      onClose();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("dayDetails")} closeLabel={tc("close")}>
      <div className="flex flex-col gap-4">
        <TextField label={t("dayTitle")} placeholder={t("dayTitlePlaceholder")} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <TextField label={t("city")} value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} />
        <Select
          label={t("lodging")}
          value={lodging}
          onChange={(e) => setLodging(e.target.value)}
          options={[
            { value: "", label: t("noLodging") },
            ...lodgings.map((p) => ({
              value: p.id,
              label: `${p.name}${p.area ? ` · ${p.area}` : ""}`,
            })),
          ]}
        />
        <p className="-mt-2 text-sm text-ink-2">{t("lodgingHint")}</p>
        <Switch label={t("flexible")} hint={t("flexibleHint")} checked={flexible} onChange={setFlexible} />
        <TextField label={t("summaryLabel")} placeholder={t("summaryPlaceholder")} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
        <TextField label={t("planBLabel")} placeholder={t("planBPlaceholder")} value={planB} maxLength={1000} onChange={(e) => setPlanB(e.target.value)} />
        <Button size="lg" block onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </Sheet>
  );
}

function StopRow({ stop, index, onOpen, canEdit, onDrop }: { stop: Stop; index: number; onOpen: () => void; canEdit: boolean; onDrop: () => void }) {
  const t = useTranslations("plan");
  const snap = useTripData();
  const controls = useDragControls();
  const place = stop.place_id ? snap.places.find((p) => p.id === stop.place_id) : null;
  const when = stop.start_time ? stop.start_time.slice(0, 5) : stop.time_of_day ? t(`tod.${stop.time_of_day}`) : null;
  return (
    <Reorder.Item value={stop.id} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="flex min-h-16 items-center gap-2 border-b border-hair bg-paper py-2">
      {canEdit ? (
        <button
          type="button"
          aria-label={t("dragStop", { name: stopLabel(snap, stop) })}
          onPointerDown={(e) => controls.start(e)}
          className="grid size-11 shrink-0 touch-none cursor-grab place-items-center text-ink-2"
        >
          <Icon name="drag" strokeWidth={4} />
        </button>
      ) : null}
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold text-[#fffcf6]"
        style={{
          background: place ? CATEGORY_COLORS[place.category] : "#6e695f",
        }}
      >
        {index + 1}
      </span>
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col items-start text-start">
        <span className="text-[17px]">{stopLabel(snap, stop)}</span>
        <span className="text-xs text-ink-2">
          {[when, stop.duration_min ? t("minutesShort", { n: stop.duration_min }) : null, stop.transport_note].filter(Boolean).join(" · ")}
        </span>
      </button>
      {place ? (
        <a
          href={googleMapsDirectionsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("navigateTo", { name: place.name })}
          className="grid size-11 shrink-0 place-items-center"
        >
          <Icon name="route" size={20} />
        </a>
      ) : null}
    </Reorder.Item>
  );
}

// Minutes since local midnight, refreshed every minute (for "next stop").
function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}
function useNowMinute(): number {
  return useSyncExternalStore(
    subscribeMinute,
    () => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    },
    () => 0,
  );
}

function TimelineStop({ item, isNext, onOpen, km }: { item: Extract<TimelineItem, { type: "stop" }>; isNext: boolean; onOpen: () => void; km?: number }) {
  const t = useTranslations("plan");
  const tp = useTranslations("places");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const s = item.stop;
  const place = s.place_id ? snap.places.find((p) => p.id === s.place_id) : null;
  const visited = place?.status === "visited";
  const { times } = usePlanPrefs();
  const when = times && s.start_time ? s.start_time.slice(0, 5) : null;
  const color = place ? CATEGORY_COLORS[place.category] : "#6e695f";
  const [open, setOpen] = useState(false);
  async function toggleVisited() {
    if (!place) return;
    await patchRow(store, "places", place.id, {
      status: visited ? "want" : "visited",
    }).catch(() => showToast({ message: tc("errorGeneric") }));
  }
  return (
    <li className="relative flex gap-3 ps-0">
      <span className="relative flex w-9 shrink-0 flex-col items-center">
        <span aria-hidden="true" className="absolute inset-y-0 w-[3px] bg-ink/25" />
        <span
          aria-hidden="true"
          className={cn(
            "relative z-10 mt-3 grid size-9 place-items-center rounded-full border-[3px] border-paper text-sm font-extrabold text-[#fffcf6]",
            isNext && "ring-4 ring-trip",
          )}
          style={{ background: visited ? "var(--ink-3)" : color }}
        >
          {visited ? <Icon name="check" size={16} strokeWidth={4} /> : item.index + 1}
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col pb-4">
        {s.transport_note || km !== undefined ? (
          <span className="mb-1 flex items-center gap-1 text-xs font-bold text-ink-2">
            <Icon name="route" size={13} />
            {s.transport_note ??
              t("distanceFromPrev", {
                km: km! < 1 ? km!.toFixed(1) : Math.round(km!),
              })}
          </span>
        ) : null}
        {/* Compact by default (a dense day reads like a schedule); tap to open the full note and actions. */}
        <div
          className={cn(
            "flex flex-col border-2 bg-surface",
            isNext ? "border-trip-ink shadow-[4px_4px_0_0_var(--trip)]" : "border-ink shadow-[3px_3px_0_0_var(--trip-tint)]",
            visited && "opacity-70",
          )}
        >
          <div className="flex">
            <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 p-3 text-start">
              <span className="flex w-full items-baseline gap-2">
                {when ? <span className="text-sm font-extrabold tabular-nums text-trip-ink">{when}</span> : null}
                <bdi className={cn("flex-1 text-[17px] font-extrabold leading-tight", visited && "line-through decoration-2")}>{stopLabel(snap, s)}</bdi>
                {isNext ? <Stamp tilt={-3}>{t("next")}</Stamp> : null}
              </span>
              <span className="text-xs text-ink-2">
                {[place ? tp(`categories.${place.category}`) : null, s.duration_min ? t("minutesShort", { n: s.duration_min }) : null, place?.area, place?.hours_text]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <TagChips tags={stopTags(s, place?.notes)} className="mt-0.5" />
            {s.notes ? <span className={cn("text-sm text-ink-2", !open && "line-clamp-1 lg:line-clamp-2")}>{s.notes}</span> : null}
            </button>
            {place ? (
              <span className="flex shrink-0 flex-col border-s border-hair">
                <a
                  href={googleMapsDirectionsUrl(place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tp("navigateTo", { name: place.name })}
                  className={cn("grid min-h-11 w-12 flex-1 place-items-center", isNext && "bg-ink text-on-ink")}
                >
                  <Icon name="navigate" size={18} />
                </a>
                <button
                  type="button"
                  aria-pressed={visited}
                  aria-label={visited ? t("visited") : t("markVisited")}
                  onClick={toggleVisited}
                  className={cn("grid min-h-11 w-12 flex-1 place-items-center border-t border-hair", visited && "bg-ink text-on-ink")}
                >
                  <Icon name="check" size={17} strokeWidth={3} />
                </button>
              </span>
            ) : null}
          </div>
          {open ? (
            <div className="flex flex-wrap gap-2 border-t border-hair px-3 py-2">
              <button type="button" onClick={onOpen} className="flex min-h-10 items-center gap-1.5 border-2 border-ink bg-surface px-3 text-sm font-bold">
                <Icon name="edit" size={15} />
                {t("stopDetails")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function TimelineBooking({ item, homeTime }: { item: Extract<TimelineItem, { type: "booking" }>; homeTime: boolean }) {
  const t = useTranslations("plan");
  const tb = useTranslations("bookings");
  const snap = useTripData();
  const b = item.booking;
  const time = item.edge === "start" ? bookingTime(b.starts_at, b.starts_tz, homeTime) : bookingTime(b.ends_at, b.ends_tz ?? b.starts_tz, homeTime);
  return (
    <li className="flex gap-3">
      <span className="relative flex w-9 shrink-0 flex-col items-center">
        <span aria-hidden="true" className="absolute inset-y-0 w-[3px] bg-ink/25" />
        <span aria-hidden="true" className="relative z-10 mt-3 grid size-9 place-items-center border-2 border-ink bg-trip text-[#fffcf6]">
          <Icon name={BOOKING_ICON[b.kind]} size={17} />
        </span>
      </span>
      <Link href={`/trips/${snap.trip!.id}/plan/bookings?open=${b.id}`} className="mb-4 flex flex-1 items-center gap-3 border-2 border-dashed border-ink bg-surface px-3 py-2.5">
        <span className="display text-2xl leading-none tabular-nums">{time ?? "—"}</span>
        <span className="flex flex-1 flex-col">
          <span className="font-extrabold">{b.title}</span>
          <span className="text-xs text-ink-2">{item.edge === "end" ? t(b.kind === "hotel" ? "checkout" : "ends") : tb(`kinds.${b.kind}`)}</span>
        </span>
      </Link>
    </li>
  );
}

export function DayScreen() {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const { date } = useParams<{ date: string }>();
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const openPrompt = useOpenPrompt();
  const trip = snap.trip!;
  const base = `/trips/${trip.id}/plan`;
  const unscheduled = date === "unscheduled";
  const day = unscheduled ? null : (snap.days.find((d) => d.date === date) ?? null);
  const dayId = day?.id ?? null;
  const allStops = snap.stops;
  const stops = useMemo(() => allStops.filter((s) => !s.deleted_at && s.day_id === dayId), [allStops, dayId]);
  const [order, setOrder] = useState<string[] | null>(null);
  const ids = useMemo(() => order ?? stops.map((s) => s.id), [order, stops]);
  const [openStop, setOpenStop] = useState<Stop | "new" | null>(null);
  const [openPlace, setOpenPlace] = useState<string | null>(null);
  const [editDay, setEditDay] = useState(false);
  const [homeTime, setHomeTime] = useState(false);
  const [arranging, setArranging] = useState(false);
  const today = useToday();
  const nowMinute = useNowMinute();
  const weatherByDate = useTripWeather(snap, today);

  const ordered = useMemo(() => ids.map((id) => stops.find((s) => s.id === id)).filter((s): s is Stop => Boolean(s)), [ids, stops]);
  const stay = day ? nightStay(snap, day) : null;

  // Persist only the moved stop: a new key between its new neighbours.
  async function drop(id: string) {
    const list = ids.map((x) => stops.find((s) => s.id === x)!).filter(Boolean);
    const i = list.findIndex((s) => s.id === id);
    const moved = list[i];
    const original = stops.findIndex((s) => s.id === id);
    setOrder(null);
    if (!moved || i === original) return;
    const position = keyBetween(list[i - 1]?.position, list[i + 1]?.position);
    await patchRow(store, "stops", id, { position }).catch(() => showToast({ message: tc("errorGeneric") }));
  }

  if (!unscheduled && !day) {
    return (
      <p className="py-10">
        <Link href={base} className="font-bold underline">
          {t("dayGone")}
        </Link>
      </p>
    );
  }

  const bookings = day ? bookingsOnDay(snap, day) : [];
  const dayIndex = day ? snap.days.findIndex((d) => d.id === day.id) : -1;
  const prev = dayIndex > 0 ? snap.days[dayIndex - 1] : null;
  const next = dayIndex >= 0 && dayIndex < snap.days.length - 1 ? snap.days[dayIndex + 1] : null;
  const timeline = buildTimeline(ordered, bookings);
  const isToday = Boolean(day && today === day.date);
  const isVisited = (s: Stop) => Boolean(s.place_id && snap.places.find((p) => p.id === s.place_id)?.status === "visited");
  const upNext = isToday ? nextStop(timeline, nowMinute, isVisited) : null;
  const upNextPlace = upNext?.place_id ? snap.places.find((p) => p.id === upNext.place_id) : null;
  const hasTimes = timeline.some((x) => x.type === "section");
  // Straight-line distance from the previous stop with a pin (shown when there's no "how to get there").
  const kmFromPrev = new Map<string, number>();
  let prevPt: { lat: number; lng: number } | null = null;
  for (const st of ordered) {
    const p = st.place_id ? snap.places.find((x) => x.id === st.place_id) : null;
    if (!p || p.lat === null || p.lng === null) continue;
    const pt = { lat: p.lat, lng: p.lng };
    if (prevPt) kmFromPrev.set(st.id, distanceKm(prevPt, pt));
    prevPt = pt;
  }
  // The day's stops with a pin, in order (lodging excluded), for "the whole day in Google Maps".
  const routePoints: { lat: number; lng: number }[] = [];
  for (const st of ordered) {
    const p = st.place_id ? snap.places.find((x) => x.id === st.place_id) : null;
    if (p && p.lat !== null && p.lng !== null && p.status !== "visited") routePoints.push({ lat: p.lat, lng: p.lng });
  }
  const routeUrl = googleMapsRouteUrl(routePoints);
  // Places on the "want" list in this day's city that aren't anywhere in the plan yet.
  const city = day ? dayCity(snap, day) : null;
  const planned = new Set(snap.stops.filter((st) => !st.deleted_at && st.place_id).map((st) => st.place_id));
  const suggestions = day
    ? live(snap.places)
        .filter((p) => p.status === "want" && p.category !== "lodging" && !planned.has(p.id) && (!city || !p.city || p.city.trim() === city))
        // Closest to the day's stops first (when both have pins), must-sees break ties.
        .map((p) => ({
          p,
          d: p.lat !== null && p.lng !== null && routePoints.length ? Math.min(...routePoints.map((r) => distanceKm(r, { lat: p.lat!, lng: p.lng! }))) : 1e6,
        }))
        .sort((a, b) => a.d - b.d || Number(b.p.priority === "must") - Number(a.p.priority === "must"))
        .map((x) => x.p)
        .slice(0, 8)
    : [];
  async function addSuggestion(placeId: string) {
    if (!day) return;
    await insertRow(store, "stops", {
      day_id: day.id,
      place_id: placeId,
      position: keyBetween(ordered.at(-1)?.position, null),
    }).catch(() => showToast({ message: tc("errorGeneric") }));
  }

  // Day facts: under the header on a phone, in a side column on a computer.
  const side = (
    <>
      {day?.notes ? <p className="border-s-4 border-trip ps-3 text-[15px] leading-relaxed">{day.notes}</p> : null}
      {day?.plan_b ? (
        <p className="border-s-4 border-ink-2 ps-3 text-sm">
          <b>{t("planB")}:</b> {day.plan_b}
        </p>
      ) : null}
      {day && ordered.length ? (
        <div className="-mt-2 flex flex-col items-center gap-1 lg:mt-0 lg:items-start">
          <p className="text-sm font-bold text-ink-2">{t("stopsCount", { n: ordered.length })}</p>
          <LoadBar stops={ordered} />
        </div>
      ) : null}
      {day && ordered.length ? <ShareDay day={day} weather={weatherByDate.get(day.date)} /> : null}
      {routeUrl ? (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 border-2 border-ink bg-surface font-extrabold shadow-[3px_3px_0_0_var(--trip-tint)]"
        >
          <Icon name="route" size={18} className="text-trip-ink" />
          {t("dayInGoogle", { n: Math.min(routePoints.length, 10) })}
        </a>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <SubHeader
        title={unscheduled ? t("unscheduledTitle") : t("dayN", { n: dayIndex + 1 })}
        backHref={base}
        backLabel={tc("back")}
        end={
          day && canEdit ? (
            <button type="button" onClick={() => setEditDay(true)} aria-label={t("dayDetails")} className="grid size-11 place-items-center">
              <Icon name="edit" />
            </button>
          ) : null
        }
      />
      {day ? (
        <div className="-mt-2 flex items-center gap-2">
          {prev ? (
            <Link href={`${base}/${prev.date}`} aria-label={t("prevDay")} className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-surface">
              <Icon name="chevron" className="-scale-x-100" />
            </Link>
          ) : (
            <span className="size-11 shrink-0" />
          )}
          <div className="flex flex-1 flex-col items-center text-center">
            <p className="font-bold">
              {weekday(day.date)} {shortDate(day.date)}
              {dayCity(snap, day) ? ` · ${dayCity(snap, day)}` : ""}
            </p>
            {day.title ? <p className="text-lg font-extrabold leading-tight">{day.title}</p> : null}
            {weatherByDate.get(day.date) ? <WeatherChip w={weatherByDate.get(day.date)!} long className="mt-0.5" /> : null}
            {day.flexible ? <Stamp tone="ink">{t("flexible")}</Stamp> : null}
          </div>
          {next ? (
            <Link href={`${base}/${next.date}`} aria-label={t("nextDay")} className="grid size-11 shrink-0 place-items-center border-2 border-ink bg-surface">
              <Icon name="chevron" />
            </Link>
          ) : (
            <span className="size-11 shrink-0" />
          )}
        </div>
      ) : (
        <p className="text-ink-2">{t("unscheduledIntro")}</p>
      )}
      <div className="flex flex-col gap-4 lg:hidden">{side}</div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-x-8">
        <div className="flex min-w-0 flex-col gap-4">
          {upNext ? (
            <section className="flex flex-col gap-2 border-2 border-ink bg-trip p-4 text-[#fffcf6] shadow-[4px_4px_0_0_var(--ink)]">
              <span className="text-sm font-extrabold opacity-90">{t("upNext")}</span>
              <span className="display text-3xl leading-tight">{stopLabel(snap, upNext)}</span>
              <span className="text-sm font-bold opacity-90">
                {[upNext.start_time?.slice(0, 5) ?? (upNext.time_of_day ? t(`tod.${upNext.time_of_day}`) : null), upNext.transport_note].filter(Boolean).join(" · ")}
              </span>
              {upNextPlace ? (
                <a
                  href={googleMapsDirectionsUrl(upNextPlace)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex min-h-12 items-center justify-center gap-2 bg-[#fffcf6] text-lg font-extrabold text-[#1c1b19]"
                >
                  <Icon name="navigate" size={20} />
                  {t("navigate")}
                </a>
              ) : null}
            </section>
          ) : null}

          <div className="flex items-end justify-between gap-3">
            <h3 className="text-lg font-extrabold">{t("stops")}</h3>
            <div className="flex items-center gap-1">
              {bookings.length ? (
                <button type="button" aria-pressed={homeTime} onClick={() => setHomeTime(!homeTime)} className="min-h-11 px-1 text-xs font-bold underline underline-offset-4">
                  {homeTime ? t("localTime") : t("israelTime")}
                </button>
              ) : null}
              {canEdit && ordered.length > 1 ? (
                <button
                  type="button"
                  aria-pressed={arranging}
                  onClick={() => setArranging(!arranging)}
                  className={cn("flex min-h-11 items-center gap-1 border-2 border-ink px-2 text-sm font-bold", arranging ? "bg-ink text-on-ink" : "bg-surface")}
                >
                  <Icon name="drag" size={16} strokeWidth={4} />
                  {arranging ? t("doneArranging") : t("arrange")}
                </button>
              ) : null}
            </div>
          </div>

          {arranging ? (
            <Reorder.Group axis="y" values={ids} onReorder={setOrder} className="flex flex-col border-t-2 border-ink">
              {ordered.map((s, i) => (
                <StopRow key={s.id} stop={s} index={i} canEdit={canEdit} onOpen={() => setOpenStop(s)} onDrop={() => void drop(s.id)} />
              ))}
            </Reorder.Group>
          ) : timeline.length === 0 ? (
            <p className="py-4 text-ink-2">{day?.flexible ? t("flexibleEmpty") : t("noStops")}</p>
          ) : (
            <ol className={cn("flex flex-col", !hasTimes && "pt-1")}>
              {timeline.map((x, i) =>
                x.type === "section" ? (
                  <li key={`sec-${x.section}-${i}`} className="mb-2 flex items-center gap-2 pt-1">
                    <span className="text-xs font-extrabold tracking-wide text-trip-ink">{t(`tod.${x.section}`)}</span>
                    <span className="h-0.5 flex-1 bg-trip-tint" />
                  </li>
                ) : x.type === "stop" ? (
                  <TimelineStop key={x.stop.id} item={x} isNext={upNext?.id === x.stop.id} km={kmFromPrev.get(x.stop.id)} onOpen={() => setOpenStop(x.stop)} />
                ) : (
                  <TimelineBooking key={x.booking.id + x.edge} item={x} homeTime={homeTime} />
                ),
              )}
              {stay ? (
                <li className="flex gap-3">
                  <span className="flex w-9 shrink-0 justify-center">
                    <span aria-hidden="true" className="mt-2 grid size-9 place-items-center rounded-full border-2 border-ink bg-surface">
                      <Icon name="bed" size={17} />
                    </span>
                  </span>
                  {stay.place ? (
                    <button type="button" onClick={() => setOpenPlace(stay.place!.id)} className="flex min-h-12 flex-1 flex-col justify-center text-start">
                      <span className="text-xs font-bold text-ink-2">{t("sleepingAt")}</span>
                      <span className="font-extrabold">
                        {stay.name}
                        {stay.suggested ? <span className="ms-1 text-xs font-bold text-danger">({t("suggestedStay")})</span> : null}
                        {stay.place.area ? <span className="font-normal text-ink-2"> · {stay.place.area}</span> : null}
                      </span>
                    </button>
                  ) : (
                    <Link href={`${base}/bookings?open=${stay.booking!.id}`} className="flex min-h-12 flex-1 flex-col justify-center text-start">
                      <span className="text-xs font-bold text-ink-2">{t("sleepingAt")}</span>
                      <span className="font-extrabold">{stay.name}</span>
                    </Link>
                  )}
                  <a
                    href={googleMapsDirectionsUrl(stay.place ?? { name: stay.name, city })}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("navigateTo", { name: stay.name })}
                    className="grid size-11 shrink-0 place-items-center self-center"
                  >
                    <Icon name="navigate" size={18} />
                  </a>
                </li>
              ) : null}
            </ol>
          )}

          {canEdit && suggestions.length && !arranging ? (
            <section className="flex flex-col gap-2 border-2 border-dashed border-ink p-3">
              <h3 className="text-sm font-extrabold">{city ? t("suggestionsIn", { city }) : t("suggestions")}</h3>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void addSuggestion(p.id)}
                    className="flex min-h-10 items-center gap-1.5 border-2 border-ink bg-surface px-2.5 text-sm font-bold active:bg-surface-2"
                  >
                    <Icon name="plus" size={14} strokeWidth={3} />
                    <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                    {p.name}
                    {p.priority === "must" ? <Icon name="star" size={13} className="text-trip-ink" /> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {canEdit ? (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => setOpenStop("new")}>
                {t("addStop")}
              </Button>
              {day ? (
                <div className="flex flex-wrap items-center gap-x-4">
                  <button
                    type="button"
                    onClick={() => openPrompt("p01-itinerary", { onlyDates: [day.date] })}
                    className="flex min-h-11 items-center gap-1 text-sm font-bold underline underline-offset-4"
                  >
                    <Icon name="copy" size={14} />
                    {t("promptThisDay")}
                  </button>
                  {ordered.length ? <ChangePlanButton date={day.date} /> : null}
                </div>
              ) : null}
              {day && !stay ? (
                <button
                  type="button"
                  onClick={() => setEditDay(true)}
                  className="flex min-h-11 items-center gap-1 self-start text-sm font-bold text-ink-2 underline underline-offset-4"
                >
                  <Icon name="bed" size={14} />
                  {t("setLodging")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <aside className="sticky top-20 hidden flex-col gap-4 lg:flex">{side}</aside>
      </div>

      <StopSheet stop={openStop && openStop !== "new" ? openStop : null} open={openStop !== null} dayId={dayId} onClose={() => setOpenStop(null)} />
      <PlaceSheet placeId={openPlace} onClose={() => setOpenPlace(null)} />
      {day ? <DaySheet key={day.id + editDay} day={day} open={editDay} onClose={() => setEditDay(false)} /> : null}
    </div>
  );
}
