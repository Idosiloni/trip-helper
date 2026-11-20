"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { googleMapsDirectionsUrl } from "@/lib/geo";
import { HOME_TZ, utcToWallTime } from "@/lib/tz";
import { nowMs } from "@/lib/use-today";
import { bookingSpan, cancelDeadlines, flightJourneys, hotelForNight, liveBookings, shortDate, weekday } from "../itinerary/helpers";
import { useTripData } from "../trip-data/TripDataProvider";
import type { Booking } from "../trip-data/types";

function wall(iso: string | null, tz: string | null) {
  return iso ? utcToWallTime(iso, tz ?? HOME_TZ) : null;
}

/** Hours from now until an instant (negative = passed). */
function hoursUntil(iso: string, now: number): number {
  return (new Date(iso).getTime() - now) / 3_600_000;
}

function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
}
/** The current time, rounded to the minute so it only re-renders once a minute. */
function useNow(): number {
  return useSyncExternalStore(subscribeMinute, () => Math.floor(nowMs() / 60_000) * 60_000, () => 0);
}

/**
 * Flights and hotels on the home screen, where they're needed:
 * the next flight (with how long until it), and where we sleep tonight.
 */
export function TravelCard({ today, phase }: { today: string; phase: "before" | "during" | "after" }) {
  const now = useNow();
  const t = useTranslations("travel");
  const snap = useTripData();
  const base = `/trips/${snap.trip!.id}/plan/bookings`;
  const bookings = liveBookings(snap);
  const upcoming = (kinds: Booking["kind"][]) =>
    bookings
      .filter((b) => kinds.includes(b.kind) && b.starts_at && hoursUntil(b.starts_at, now) > -3)
      .sort((a, b) => (a.starts_at! < b.starts_at! ? -1 : 1))[0] ?? null;

  const flight = upcoming(["flight", "train"]);
  const flightIn = flight ? hoursUntil(flight.starts_at!, now) : null;
  // A flight is shown with its connections (TLV → Abu Dhabi → Tokyo), and before the trip the way home too.
  const journeys = flightJourneys(bookings);
  const journey = flight?.kind === "flight" ? (journeys.find((j) => j.some((b) => b.id === flight.id)) ?? [flight]) : flight ? [flight] : [];
  const legs = journey.filter((b) => hoursUntil(b.starts_at!, now) > -3 || b.id === flight?.id);
  const home = phase === "before" && journeys.length > 1 && journeys.at(-1) !== journey ? journeys.at(-1)! : null;
  const deadlines = cancelDeadlines(bookings, today);
  // During the trip only flights in the next three days matter on the home screen.
  const showFlight = flight && (phase === "before" || (flightIn !== null && flightIn < 72));
  const tonight = phase === "during" ? hotelForNight(snap, today) : null;
  const checkoutToday = phase === "during" ? bookings.find((b) => b.kind === "hotel" && bookingSpan(b).end === today) : null;
  const firstHotel = phase === "before" ? upcoming(["hotel"]) : null;
  const hotel = tonight ?? firstHotel;

  if (!now || (!showFlight && !hotel && !checkoutToday && !deadlines.length)) return null;

  const hotelPlace = hotel?.place_id ? snap.places.find((p) => p.id === hotel.place_id) : null;

  return (
    <section className="flex flex-col gap-2">
      {deadlines.map((b) => (
        <Link key={b.id} href={`${base}?open=${b.id}`} className="flex items-center gap-3 border-2 border-ink bg-trip-tint p-3">
          <Icon name="clock" size={20} className="shrink-0" />
          <span className="flex flex-col">
            <span className="font-extrabold">{t("freeCancel", { name: b.title, date: shortDate(b.cancel_by!) })}</span>
            <span className="text-sm">{b.cancel_by === today ? t("cancelLastDay") : t("cancelInDays", { n: Math.round((Date.parse(b.cancel_by!) - Date.parse(today)) / 86_400_000) })}</span>
          </span>
        </Link>
      ))}
      {showFlight && flight ? (
        <Link href={`${base}?open=${flight.id}`} className="flex flex-col gap-1 border-2 border-ink bg-surface p-4 shadow-[3px_3px_0_0_var(--trip)]">
          <span className="flex items-center gap-2 text-sm font-extrabold text-trip-ink">
            <Icon name={flight.kind === "train" ? "train" : "plane"} size={18} />
            {flight.kind === "train" ? t("nextTrain") : t("nextFlight")}
            {flightIn !== null && flightIn > 0 ? (
              <span className="ms-auto text-ink">{flightIn < 48 ? t("inHours", { n: Math.round(flightIn) }) : t("inDays", { n: Math.round(flightIn / 24) })}</span>
            ) : null}
          </span>
          {legs.map((b, i) => (
            <span key={b.id} className={i ? "flex flex-col gap-1 border-t border-hair pt-2" : "flex flex-col gap-1"}>
              <span className={i ? "text-lg font-extrabold leading-tight" : "text-xl font-extrabold leading-tight"}>{b.title}</span>
              <FlightTimes b={b} />
            </span>
          ))}
          {legs.some((b) => b.confirmation_code) ? <span className="text-xs font-bold text-ink-2">{t("hasCode")}</span> : null}
        </Link>
      ) : null}

      {showFlight && home ? (
        <Link href={base} className="flex flex-col gap-1 border-2 border-dashed border-ink p-3">
          <span className="flex items-center gap-2 text-sm font-extrabold text-ink-2">
            <Icon name="plane" size={16} className="-scale-x-100" />
            {t("flightHome")}
          </span>
          {home.map((b) => (
            <span key={b.id} className="flex flex-col">
              <span className="font-bold leading-tight">{b.title}</span>
              <FlightTimes b={b} />
            </span>
          ))}
        </Link>
      ) : null}

      {checkoutToday && checkoutToday.id !== tonight?.id ? (
        <Link href={`${base}?open=${checkoutToday.id}`} className="flex items-center gap-3 border-2 border-dashed border-ink p-3">
          <Icon name="bag" size={20} className="shrink-0 text-trip-ink" />
          <span className="flex flex-col">
            <span className="font-extrabold">{t("checkoutToday", { name: checkoutToday.title })}</span>
            {wall(checkoutToday.ends_at, checkoutToday.ends_tz ?? checkoutToday.starts_tz) ? (
              <span className="text-sm text-ink-2" dir="ltr">
                {t("until", { time: wall(checkoutToday.ends_at, checkoutToday.ends_tz ?? checkoutToday.starts_tz)!.time })}
              </span>
            ) : null}
          </span>
        </Link>
      ) : null}

      {hotel ? (
        <div className="flex items-stretch border-2 border-ink bg-surface">
          <Link href={`${base}?open=${hotel.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
            <Icon name="bed" size={22} className="shrink-0 text-trip-ink" />
            <span className="flex min-w-0 flex-col">
              <span className="text-xs font-extrabold text-ink-2">{tonight ? t("tonight") : t("firstHotel")}</span>
              <span className="truncate text-lg font-extrabold">{hotelPlace?.name ?? hotel.title}</span>
              <span className="text-xs text-ink-2">{hotelNights(hotel, t)}</span>
            </span>
          </Link>
          <a
            href={googleMapsDirectionsUrl(hotelPlace ?? { name: hotel.title })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("navigateTo", { name: hotelPlace?.name ?? hotel.title })}
            className="grid w-14 shrink-0 place-items-center border-s-2 border-ink bg-ink text-on-ink"
          >
            <Icon name="navigate" size={20} />
          </a>
        </div>
      ) : null}
    </section>
  );
}

function hotelNights(b: Booking, t: ReturnType<typeof useTranslations<"travel">>): string {
  const { start, end } = bookingSpan(b);
  if (!start) return "";
  const nights = end ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) : 0;
  return [`${shortDate(start)}${end ? `–${shortDate(end)}` : ""}`, nights > 0 ? t("nights", { n: nights }) : null].filter(Boolean).join(" · ");
}

export function FlightTimes({ b }: { b: Booking }) {
  const s = wall(b.starts_at, b.starts_tz);
  const e = wall(b.ends_at, b.ends_tz ?? b.starts_tz);
  if (!s) return null;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
      <span>
        {weekday(s.date)} {shortDate(s.date)}
      </span>
      <span dir="ltr" className="tabular-nums">
        {s.time}
        {e ? ` → ${e.time}${e.date !== s.date ? ` (${shortDate(e.date)})` : ""}` : ""}
      </span>
    </span>
  );
}
