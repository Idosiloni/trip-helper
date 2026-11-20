"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Stamp } from "@/components/ui/Stamp";
import { useToday } from "@/lib/use-today";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { useTripData } from "../trip-data/TripDataProvider";
import type { Booking, Stop, TripDay } from "../trip-data/types";
import { bookingsOnDay, dayCity, nightStay, shortDate, stopLabel, stopsOfDay, weekday } from "./helpers";
import type { TripSnapshot } from "../trip-data/types";
import { PlanTabs } from "./PlanTabs";
import { BookAheadButton, DayPeek, DoubledPlanBanner, LoadBar } from "./DayExtras";
import { dayParts } from "./timeline";
import { setPlanPrefs, usePlanPrefs, type PlanView } from "./plan-prefs";
import { buildGuide } from "../journal/guide";
import { GuideDayBlock } from "../journal/GuideDay";
import { parseTripProfile } from "@/lib/trip-profile";
import type { DayWeather } from "@/lib/weather";
import { useTripWeather } from "../weather/useTripWeather";
import { WeatherChip } from "../weather/WeatherChip";

export const BOOKING_ICON: Record<Booking["kind"], IconName> = {
  flight: "plane",
  hotel: "bed",
  train: "train",
  car: "car",
  attraction: "star",
  other: "clock",
};

/** Consecutive days in the same city: the legs of the trip. */
function legsOf(snap: TripSnapshot): { city: string | null; days: TripDay[] }[] {
  const legs: { city: string | null; days: TripDay[] }[] = [];
  for (const d of snap.days) {
    const city = dayCity(snap, d);
    const last = legs.at(-1);
    if (last && last.city === city) last.days.push(d);
    else legs.push({ city, days: [d] });
  }
  return legs;
}

// Alternating strengths of the trip color, so neighbouring legs read apart.
const LEG_TINTS = [70, 38, 54, 26];
const legStyle = (i: number): CSSProperties => ({ background: `color-mix(in srgb, var(--trip) ${LEG_TINTS[i % LEG_TINTS.length]}%, var(--surface))` });

const PARTS = ["morning", "noon", "evening"] as const;

/** Stop names joined into one short line ("Meiji Jingu · Omotesando · Tonkatsu Maisen"). */
function namesLine(snap: TripSnapshot, stops: Stop[], visited: Set<string>) {
  return stops.map((st) => ({ id: st.id, label: stopLabel(snap, st), done: Boolean(st.place_id && visited.has(st.place_id)), time: st.start_time?.slice(0, 5) ?? null, note: st.notes }));
}

type Item = { id: string; label: string; done: boolean; time: string | null; note: string | null };

/** The expanded table cell: each stop on its own line with its time and the start of its note. */
function Details({ items }: { items: Item[] }) {
  const { times } = usePlanPrefs();
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((x) => (
        <li key={x.id} className="flex flex-col">
          <span className="text-[15px] leading-snug">
            {times && x.time ? <span className="me-1.5 text-xs font-extrabold tabular-nums text-trip-ink">{x.time}</span> : null}
            <bdi className={cn("font-bold", x.done && "text-ink-3 line-through")}>{x.label}</bdi>
          </span>
          {x.note ? <span className="line-clamp-2 text-xs text-ink-2">{x.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Names({ items }: { items: Item[] }) {
  return (
    <span className="line-clamp-2 text-[15px] leading-snug">
      {items.map((x, i) => (
        <span key={x.id}>
          {i > 0 ? <span className="px-1 text-ink-3">·</span> : null}
          <bdi className={cn(x.done && "text-ink-3 line-through")}>{x.label}</bdi>
        </span>
      ))}
    </span>
  );
}

function useDayInfo(day: TripDay) {
  const snap = useTripData();
  const stops = stopsOfDay(snap, day.id).sort((a, b) => (a.position < b.position ? -1 : 1));
  const visited = new Set(snap.places.filter((p) => p.status === "visited").map((p) => p.id));
  const parts = dayParts(stops);
  return {
    snap,
    stops,
    parts: {
      anytime: namesLine(snap, parts.anytime, visited),
      morning: namesLine(snap, parts.morning, visited),
      noon: namesLine(snap, parts.noon, visited),
      evening: namesLine(snap, parts.evening, visited),
    },
    bookings: bookingsOnDay(snap, day).filter(({ booking }) => booking.kind !== "hotel"),
    stay: nightStay(snap, day),
  };
}

/** Phone: one card per day, the day as three short lines (morning, noon, evening). */
function DayCard({ day, index, today, weather }: { day: TripDay; index: number; today: string | null; weather?: DayWeather }) {
  const t = useTranslations("plan");
  const openPrompt = useOpenPrompt();
  const { snap, stops, parts, bookings, stay } = useDayInfo(day);
  const base = `/trips/${snap.trip!.id}/plan`;
  const isToday = today === day.date;
  const past = today !== null && day.date < today;
  const empty = stops.length === 0 && bookings.length === 0;

  return (
    <li id={`day-${day.date}`} className={cn("scroll-mt-28", past && "opacity-60")}>
      <div
        className={cn(
          "relative flex gap-3 border-2 bg-surface p-3",
          isToday ? "border-trip-ink shadow-[4px_4px_0_0_var(--trip)]" : empty && !day.flexible ? "border-dashed border-ink" : "border-ink shadow-[3px_3px_0_0_var(--trip-tint)]",
        )}
      >
        <Link href={`${base}/${day.date}`} className="flex w-14 shrink-0 flex-col items-center border-e-2 border-dashed border-ink pe-3 after:absolute after:inset-0">
          <span className="text-[11px] font-extrabold text-ink-2">{t("dayN", { n: index + 1 })}</span>
          <span className="display text-[2.4rem] leading-none tabular-nums">{Number(day.date.slice(8))}</span>
          <span className="text-[11px] font-bold text-ink-2">{weekday(day.date).replace("יום ", "")}</span>
        </Link>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-start gap-2">
            <span className="flex-1 text-[17px] font-extrabold leading-tight">{day.title || (empty ? (day.flexible ? t("flexible") : t("emptyDay")) : "")}</span>
            {isToday ? <Stamp tilt={-4}>{t("today")}</Stamp> : null}
            {weather ? <WeatherChip w={weather} className="shrink-0 pt-0.5" /> : null}
          </span>
          {day.notes ? <span className="line-clamp-2 text-sm leading-snug text-ink-2">{day.notes}</span> : null}
          {stops.length ? <LoadBar stops={stops} /> : null}
          {parts.anytime.length ? <Names items={parts.anytime} /> : null}
          {PARTS.map((k) =>
            parts[k].length ? (
              <span key={k} className="flex items-baseline gap-2">
                <span className="w-11 shrink-0 text-xs font-extrabold text-trip-ink">{t(`tod.${k}`)}</span>
                <Names items={parts[k]} />
              </span>
            ) : null,
          )}
          {empty && !day.flexible ? (
            <button
              type="button"
              onClick={() => openPrompt("p01-itinerary", { onlyDates: [day.date] })}
              className="relative z-10 flex min-h-10 items-center gap-1.5 self-start border-2 border-ink bg-surface px-2.5 text-sm font-bold"
            >
              <Icon name="copy" size={14} />
              {t("planThisDay")}
            </button>
          ) : null}
          {bookings.length || stay ? (
            <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-hair pt-1.5 text-xs font-bold">
              {bookings.map(({ booking, edge }) => (
                <span key={booking.id + edge} className="flex items-center gap-1">
                  <Icon name={BOOKING_ICON[booking.kind]} size={14} className="text-trip-ink" />
                  {booking.title}
                  {edge === "end" ? <span className="font-normal text-ink-2">({t("ends")})</span> : null}
                </span>
              ))}
              {stay ? (
                <span className="flex items-center gap-1 text-ink-2">
                  <Icon name="bed" size={14} />
                  {stay.name}
                  {stay.suggested ? <span className="ms-1 text-xs font-bold text-danger">({t("suggestedStay")})</span> : null}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </div>
    </li>
  );
}

/** Computer: the whole trip as a table, one row per day. */
function DaysTable({ legs, today, weather }: { legs: { city: string | null; days: TripDay[] }[]; today: string | null; weather: Map<string, DayWeather> }) {
  const t = useTranslations("plan");
  const [peek, setPeek] = useState<TripDay | null>(null);
  const [expanded, setExpanded] = useState(false);
  let n = 0;
  return (
    <>
    <DayPeek day={peek} onClose={() => setPeek(null)} />
    <div className="mb-2 hidden items-center justify-between lg:flex">
      <p className="text-sm text-ink-2">{t("tableHint")}</p>
      <button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)} className={cn("flex min-h-10 items-center gap-1.5 border-2 border-ink px-3 text-sm font-bold", expanded ? "bg-ink text-on-ink" : "bg-surface")}>
        {expanded ? t("compactView") : t("expandedView")}
      </button>
    </div>
    <table className="hidden w-full border-collapse border-2 border-ink bg-surface text-start lg:table">
      <thead>
        <tr className="border-b-2 border-ink bg-surface-2 text-sm">
          <th className="w-48 p-2 text-start font-extrabold">{t("colDay")}</th>
          <th className="w-28 p-2 text-start font-extrabold">{t("colCity")}</th>
          {PARTS.map((k) => (
            <th key={k} className="p-2 text-start font-extrabold">
              {t(`tod.${k}`)}
            </th>
          ))}
          <th className="w-44 p-2 text-start font-extrabold">{t("colStay")}</th>
        </tr>
      </thead>
      <tbody>
        {legs.map((leg, li) =>
          leg.days.map((d, di) => (
            <DayRow key={d.id} day={d} index={n++} legIndex={li} first={di === 0} span={leg.days.length} city={leg.city} today={today} weather={weather.get(d.date)} onPeek={() => setPeek(d)} expanded={expanded} />
          )),
        )}
      </tbody>
    </table>
    </>
  );
}

function DayRow({ day, index, legIndex, first, span, city, today, weather, onPeek, expanded }: { day: TripDay; index: number; legIndex: number; first: boolean; span: number; city: string | null; today: string | null; weather?: DayWeather; onPeek: () => void; expanded: boolean }) {
  const t = useTranslations("plan");
  const openPrompt = useOpenPrompt();
  const { snap, stops, parts, bookings, stay } = useDayInfo(day);
  const href = `/trips/${snap.trip!.id}/plan/${day.date}`;
  const isToday = today === day.date;
  const empty = stops.length === 0 && bookings.length === 0;
  const cell = (k: (typeof PARTS)[number]) => {
    const items = k === "morning" ? [...parts.anytime, ...parts.morning] : parts[k];
    return <td className="border-s border-hair p-2 align-top">{items.length ? expanded ? <Details items={items} /> : <Names items={items} /> : null}</td>;
  };
  return (
    <tr
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button")) onPeek();
      }}
      className={cn("cursor-pointer border-b border-hair align-top hover:bg-surface-2", isToday && "outline outline-2 -outline-offset-2 outline-trip-ink", today !== null && day.date < today && "opacity-60")}
    >
      <td className="p-2">
        <Link href={href} className="flex flex-col">
          <span className="text-xs font-extrabold text-ink-2">{t("dayN", { n: index + 1 })}</span>
          <span className="font-extrabold">
            {weekday(day.date).replace("יום ", "")} {shortDate(day.date)}
          </span>
          {weather ? <WeatherChip w={weather} className="text-xs" /> : null}
          {day.title ? <span className="mt-1 font-extrabold leading-tight text-trip-ink">{day.title}</span> : null}
          {expanded && day.notes ? <span className="mt-0.5 text-xs leading-snug text-ink-2">{day.notes}</span> : null}
        </Link>
        {stops.length ? <LoadBar stops={stops} compact className="mt-1" /> : null}
      </td>
      {first ? (
        <td rowSpan={span} className="border-s-2 border-ink p-2 align-top font-extrabold" style={legStyle(legIndex)}>
          {city ?? t("noCity")}
        </td>
      ) : null}
      {empty && !day.flexible ? (
        <td colSpan={3} className="border-s border-hair p-2">
          <span className="flex items-center gap-3">
            <span className="font-bold text-ink-2">{t("emptyDay")}</span>
            <button type="button" onClick={() => openPrompt("p01-itinerary", { onlyDates: [day.date] })} className="flex min-h-9 items-center gap-1.5 border-2 border-ink bg-surface px-2 text-sm font-bold">
              <Icon name="copy" size={14} />
              {t("planThisDay")}
            </button>
          </span>
        </td>
      ) : (
        <>
          {cell("morning")}
          {cell("noon")}
          {cell("evening")}
        </>
      )}
      <td className="border-s border-hair p-2 text-sm">
        {bookings.map(({ booking, edge }) => (
          <span key={booking.id + edge} className="flex items-center gap-1 text-xs font-bold">
            <Icon name={BOOKING_ICON[booking.kind]} size={13} className="text-trip-ink" />
            {booking.title}
          </span>
        ))}
        {stay ? (
          <span className="flex items-center gap-1">
            <Icon name="bed" size={14} className="shrink-0" />
            {stay.name}
                  {stay.suggested ? <span className="ms-1 text-xs font-bold text-danger">({t("suggestedStay")})</span> : null}
          </span>
        ) : null}
      </td>
    </tr>
  );
}

/** "How to show the days": table (computer), cards, or a flowing document; and exact times on or off. */
function ViewPicker() {
  const t = useTranslations("plan");
  const { view, times } = usePlanPrefs();
  const options: { id: PlanView; desktopOnly?: boolean }[] = [{ id: "table", desktopOnly: true }, { id: "cards" }, { id: "story" }];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label={t("viewLabel")} className="flex border-2 border-ink">
        {options.map((o) => {
          // On a phone there's no table: "table" shows as cards.
          const on = view === o.id || (o.id === "cards" && view === "table");
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={view === o.id}
              onClick={() => setPlanPrefs({ view: o.id })}
              className={cn(
                "min-h-10 border-e-2 border-ink px-3 text-sm font-bold last:border-e-0",
                o.desktopOnly && "hidden lg:block",
                o.id === "cards" && view === "table" ? "max-lg:bg-ink max-lg:text-on-ink lg:bg-surface" : on ? "bg-ink text-on-ink" : "bg-surface",
              )}
            >
              {t(`views.${o.id}`)}
            </button>
          );
        })}
      </div>
      <button type="button" aria-pressed={times} onClick={() => setPlanPrefs({ times: !times })} className={cn("flex min-h-10 items-center gap-1.5 border-2 border-ink px-3 text-sm font-bold", times ? "bg-ink text-on-ink" : "bg-surface")}>
        <Icon name="clock" size={15} />
        {times ? t("timesOn") : t("timesOff")}
      </button>
    </div>
  );
}

/** The plan as a document: each day written out like a booklet page, city by city. */
function StoryView() {
  const snap = useTripData();
  const days = buildGuide(snap).days;
  const { times } = usePlanPrefs();
  const base = `/trips/${snap.trip!.id}/plan`;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {days.map((d, i) => (
        <div key={d.date} id={`day-${d.date}`} className="flex scroll-mt-24 flex-col gap-2">
          {d.city !== days[i - 1]?.city && d.city ? <p className="display text-[2rem] text-trip-ink">{d.city}</p> : null}
          <GuideDayBlock d={d} times={times} href={`${base}/${d.date}`} />
        </div>
      ))}
    </div>
  );
}

export function DaysScreen() {
  const t = useTranslations("plan");
  const snap = useTripData();
  const openPrompt = useOpenPrompt();
  const today = useToday();
  const trip = snap.trip!;
  const base = `/trips/${trip.id}/plan`;
  const unscheduled = stopsOfDay(snap, null).length;
  const anyStops = snap.stops.some((s) => !s.deleted_at && s.day_id);
  const legs = legsOf(snap);
  const named = legs.filter((l) => l.city);
  const todayInTrip = today ? snap.days.some((d) => d.date === today) : false;
  const weather = useTripWeather(snap, today);
  const { view } = usePlanPrefs();
  const overview = parseTripProfile(trip.profile).overview;
  let dayIndex = 0;

  return (
    <div className="flex flex-col">
      <PlanTabs tripId={trip.id} />
      {snap.days.length === 0 ? (
        <EmptyState
          icon="route"
          title={t("noDatesTitle")}
          body={t("noDatesBody")}
          action={
            <Link href={`/trips/${trip.id}/settings/profile`} className="font-bold underline underline-offset-4">
              {t("setDates")}
            </Link>
          }
        />
      ) : (
        <>
          {named.length ? (
            <nav aria-label={t("route")} className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {/* Each leg gets room for its name (never squeezed into its neighbour); a long route scrolls sideways. */}
              <div className="flex min-w-full w-max border-2 border-ink">
                {legs.map((leg, i) =>
                  leg.city ? (
                    <a
                      key={`${leg.city}-${i}`}
                      href={`#leg-${i}`}
                      style={{ ...legStyle(i), flexGrow: leg.days.length, minWidth: `${Math.max(5.5, Math.min(leg.city.length * 0.62 + 1.4, 9))}rem` }}
                      className="flex min-h-14 basis-0 flex-col justify-center border-e-2 border-ink px-2.5 last:border-e-0"
                    >
                      <span className="whitespace-nowrap text-[15px] font-extrabold leading-tight">{leg.city}</span>
                      <span className="whitespace-nowrap text-[11px] font-bold">
                        {t("daysShort", { n: leg.days.length })} · {shortDate(leg.days[0].date)}
                      </span>
                    </a>
                  ) : (
                    <span key={`none-${i}`} style={{ flexGrow: leg.days.length }} className="min-h-14 min-w-8 basis-0 border-e-2 border-ink bg-surface-2 last:border-e-0" />
                  ),
                )}
              </div>
            </nav>
          ) : null}

          <DoubledPlanBanner />
          <div className="mb-5 flex flex-wrap gap-2">
            {todayInTrip ? (
              <a href={`${base}/${today}`} className="flex min-h-11 items-center gap-1.5 bg-ink px-3 text-sm font-extrabold text-on-ink">
                <Icon name="sun" size={16} />
                {t("openToday")}
              </a>
            ) : null}
            <button type="button" onClick={() => openPrompt("p01-itinerary")} className="flex min-h-11 items-center gap-1.5 border-2 border-ink bg-surface px-3 text-sm font-bold">
              <Icon name="copy" size={16} />
              {anyStops ? t("promptFill") : t("promptSkeleton")}
            </button>
            <BookAheadButton />
            <Link href={`${base}/lodging`} className="flex min-h-11 items-center gap-1.5 border-2 border-ink bg-surface px-3 text-sm font-bold">
              <Icon name="bed" size={16} />
              {t("lodgingByCity")}
            </Link>
            {anyStops ? (
              <button type="button" onClick={() => openPrompt("p07-review")} className="flex min-h-11 items-center gap-1.5 border-2 border-ink bg-surface px-3 text-sm font-bold">
                <Icon name="check" size={16} />
                {t("promptReview")}
              </button>
            ) : null}
          </div>

          {overview ? (
            <details className="mb-4 border-2 border-ink bg-surface p-3">
              <summary className="cursor-pointer font-extrabold">{t("overview")}</summary>
              <p className="mt-2 max-w-prose text-[15px] leading-relaxed">{overview}</p>
            </details>
          ) : null}
          <ViewPicker />
          {view === "story" ? <StoryView /> : null}
          {view === "table" ? <DaysTable legs={legs} today={today} weather={weather} /> : null}
          <div className={cn("flex flex-col gap-6", view === "story" ? "hidden" : view === "table" && "lg:hidden")}>
            {legs.map((leg, i) => (
              <section key={`leg-${i}`} id={`leg-${i}`} className="flex scroll-mt-24 flex-col gap-3">
                <h3 className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-4 border-2 border-ink" style={legStyle(i)} />
                  <span className="text-lg font-extrabold">{leg.city ?? t("noCity")}</span>
                  <span className="text-sm font-bold text-ink-2">
                    · {shortDate(leg.days[0].date)}
                    {leg.days.length > 1 ? `–${shortDate(leg.days.at(-1)!.date)}` : ""}
                  </span>
                </h3>
                <ol className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
                  {leg.days.map((d) => (
                    <DayCard key={d.id} day={d} index={dayIndex++} today={today} weather={weather.get(d.date)} />
                  ))}
                </ol>
              </section>
            ))}
          </div>

          {unscheduled ? (
            <Link href={`${base}/unscheduled`} className="mt-6 flex min-h-12 items-center justify-between border-2 border-dashed border-ink px-3 font-bold">
              {t("unscheduled", { n: unscheduled })}
              <Icon name="chevron" className="ltr:-scale-x-100" />
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
