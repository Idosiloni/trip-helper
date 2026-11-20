"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { daysBetween, formatDateRange } from "@/lib/dates";
import { parseTripProfile } from "@/lib/trip-profile";
import type { DayWeather } from "@/lib/weather";
import { live } from "../lists/helpers";
import { planCities } from "../setup/profile-sync";
import { useTripData } from "../trip-data/TripDataProvider";
import { WeatherChip } from "../weather/WeatherChip";

/**
 * The top of the home screen: the trip as a ticket. The big number (days to go,
 * or which day it is), the route, the dates, and who's coming.
 */
export function TripHero({ big, weather, weatherLabel }: { big: ReactNode; weather?: DayWeather; weatherLabel?: string }) {
  const t = useTranslations("hero");
  const tt = useTranslations("trips");
  const snap = useTripData();
  const trip = snap.trip!;
  const base = `/trips/${trip.id}`;
  const fromPlan = planCities(snap).map((c) => c.name);
  const route = fromPlan.length ? fromPlan : parseTripProfile(trip.profile).destinations.flatMap((d) => (d.cities.length ? d.cities.map((c) => c.name) : [d.country]));
  const travelers = live(snap.travelers);
  const nights = trip.start_date && trip.end_date ? daysBetween(trip.start_date, trip.end_date) : null;

  return (
    <section className="relative overflow-hidden border-2 border-ink bg-surface shadow-[5px_5px_0_0_var(--trip)]">
      <span aria-hidden="true" className="halftone absolute -end-10 -top-10 size-40 rounded-full opacity-40" />
      <div className="relative flex flex-col gap-3 p-4">
        {big}
        {route.length ? (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-lg font-extrabold leading-tight">
            {route.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1.5">
                <bdi>{c}</bdi>
                {i < route.length - 1 ? (
                  <span aria-hidden="true" className="text-trip-ink">
                    ←
                  </span>
                ) : null}
              </span>
            ))}
          </p>
        ) : (
          <Link href={`${base}/settings/profile`} className="self-start font-bold underline underline-offset-4">
            {t("addDestination")}
          </Link>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-ink-2">
          <span>{trip.start_date ? formatDateRange(trip.start_date, trip.end_date) : tt("noDates")}</span>
          {nights ? <span>{t("nights", { n: nights })}</span> : null}
          {weather ? (
            <span className="flex items-center gap-1.5 text-ink">
              {weatherLabel}
              <WeatherChip w={weather} long className="text-sm" />
            </span>
          ) : null}
        </p>
      </div>
      <div className="relative flex items-center gap-2 border-t-2 border-dashed border-ink px-4 py-2.5">
        <Icon name="users" size={18} className="shrink-0 text-trip-ink" />
        {travelers.length ? (
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {travelers.map((x) => (
              <span key={x.id} className="border border-ink px-1.5 text-sm font-bold">
                {x.label}
              </span>
            ))}
          </span>
        ) : (
          <span className="flex-1 text-sm font-bold">{t("whoIsComing")}</span>
        )}
        <Link href={`${base}/settings/travelers`} className="shrink-0 text-sm font-bold underline underline-offset-4">
          {travelers.length ? t("editTravelers") : t("addTravelers")}
        </Link>
      </div>
    </section>
  );
}
