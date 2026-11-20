"use client";

import { FamilyTasks } from "./FamilyTasks";
import { TripHero } from "./TripHero";
import { PushPrompt } from "../notifications/PushPrompt";
import { TravelCard } from "./TravelCard";
import { HelpNow, NearMe, TodayPlan } from "./DuringToday";
import { AfterToday, MomentButton } from "../journal/AfterToday";
import { useTripWeather } from "../weather/useTripWeather";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Stamp } from "@/components/ui/Stamp";
import { daysBetween, tripDay, tripPhase } from "@/lib/dates";
import { findMissing, type Missing } from "@/lib/rules/missing";
import { parseTripProfile } from "@/lib/trip-profile";
import { useToday } from "@/lib/use-today";
import { bookingSpan, dayCity, flightJourneys, hasStay, isTransitCity, nightOnTheWay } from "../itinerary/helpers";
import { live } from "../lists/helpers";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { useTripData } from "../trip-data/TripDataProvider";

/** A row of cells, filled for done (the family progress bar). */
function MissingCard({ m, base }: { m: Missing; base: string }) {
  const t = useTranslations("today");
  const openPrompt = useOpenPrompt();
  const LINKS = { profile: "settings/profile", travelers: "settings/travelers", tasks: "lists/tasks", packing: "lists/packing", plan: "plan", places: "places", confirm: "places/confirm", lodging: "plan/lodging" } as const;
  const href = m.action.type === "link" ? `${base}/${LINKS[m.action.to]}${m.action.filter ? `?filter=${m.action.filter}` : ""}` : null;
  return (
    <li className={`flex flex-col gap-2 border-2 bg-surface p-4 ${m.level === "urgent" ? "border-ink" : "border-dashed border-ink"}`}>
      <div className="flex items-center gap-2">
        <Stamp tone={m.level === "urgent" ? "trip" : "ink"}>{t(`levels.${m.level}`)}</Stamp>
        <span className="text-[17px] font-extrabold">{t(`missing.${m.id}.title`, { n: m.count ?? 0, days: m.daysLeft ?? 0, today: m.todayCount ?? 0 })}</span>
      </div>
      <p className="text-sm text-ink-2">{t(`missing.${m.id}.body`, { n: m.count ?? 0, days: m.daysLeft ?? 0, today: m.todayCount ?? 0 })}</p>
      {m.action.type === "prompt" ? (
        <Button className="self-start" onClick={() => openPrompt(m.action.type === "prompt" ? m.action.promptId : undefined)} icon={<Icon name="copy" size={18} />}>
          {t("copyPrompt")}
        </Button>
      ) : href ? (
        <Link href={href} className="flex min-h-11 items-center gap-1 self-start font-bold underline underline-offset-4">
          {t(`missing.${m.id}.cta`)}
          <Icon name="chevron" size={18} className="ltr:-scale-x-100" />
        </Link>
      ) : null}
    </li>
  );
}

export function TodayScreen() {
  const t = useTranslations("trips");
  const tt = useTranslations("today");
  const tp = useTranslations("tripPages");
  const snap = useTripData();
  const today = useToday();
  const weather = useTripWeather(snap, today);
  const trip = snap.trip!;
  if (!today) return null;
  const phase = tripPhase(trip, today);
  const base = `/trips/${trip.id}`;
  const tasks = live(snap.tasks);
  const packing = live(snap.packing);

  let hero = null;
  if (trip.start_date && phase === "before") {
    // Count to the first flight when it's saved (it can leave the day before the trip starts).
    const first = flightJourneys(snap.bookings)[0]?.[0];
    const departs = first ? bookingSpan(first).start : null;
    const days = Math.max(0, daysBetween(today, departs && departs >= today ? departs : trip.start_date));
    hero =
      days === 0 ? (
        <p className="display print-offset text-[5rem]">{tp("flightToday")}</p>
      ) : (
        <div className="flex items-end gap-3">
          <span className="display print-offset text-[7.5rem] leading-[0.78] tabular-nums">{days}</span>
          <span className="flex flex-col gap-1 pb-2">
            <Icon name="plane" size={28} className="text-trip-ink" />
            <span className="max-w-20 text-xl font-extrabold leading-tight">{tp("daysToFlight", { days })}</span>
          </span>
        </div>
      );
  } else if (trip.start_date && phase === "during") {
    const d = tripDay(trip, today);
    // A manual "during" outside the dates has no meaningful day number.
    if (d && d.day >= 1 && d.day <= d.total) hero = <p className="display print-offset text-[5.5rem]">{t("dayOf", { day: d.day, total: d.total })}</p>;
  } else if (phase === "after") {
    hero = <p className="display print-offset text-[5.5rem]">{t("ended")}</p>;
  }

  const missing =
    phase === "before"
      ? findMissing({
          today,
          startDate: trip.start_date,
          profile: parseTripProfile(trip.profile),
          travelerCount: live(snap.travelers).length,
          tasks,
          packing,
          days: snap.days,
          stops: snap.stops,
          places: snap.places,
          // Nights with somewhere to sleep (a hotel booking or a hotel in the plan), plus travel nights.
          hotelNights: new Set(snap.days.filter((d) => hasStay(snap, d) || isTransitCity(dayCity(snap, d)) || nightOnTheWay(snap, d)).map((d) => d.date)),
        })
      : [];

  return (
    <div className="flex flex-col gap-7 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-10">
      <div className="flex min-w-0 flex-col gap-7">
      <TripHero
        big={hero}
        weather={phase === "during" ? weather.get(today) : phase === "before" && trip.start_date && weather.get(trip.start_date)?.source === "forecast" ? weather.get(trip.start_date) : undefined}
        weatherLabel={phase === "before" ? tt("firstDayWeather") : undefined}
      />

      {phase !== "after" && !snap.stops.some((x) => !x.deleted_at) && !live(snap.places).length ? (
        <Link href={`${base}/import/plan`} className="flex items-center gap-3 border-2 border-ink bg-surface p-4 shadow-[3px_3px_0_0_var(--trip-tint)]">
          <Icon name="paste" size={26} className="shrink-0 text-trip-ink" />
          <span className="flex flex-1 flex-col">
            <span className="text-lg font-extrabold">{tt("wholePlanTitle")}</span>
            <span className="text-sm text-ink-2">{tt("wholePlanBody")}</span>
          </span>
          <Icon name="chevron" className="ltr:-scale-x-100" />
        </Link>
      ) : null}

      {phase !== "after" ? <TravelCard today={today} phase={phase} /> : null}

      {phase === "during" ? (
        <>
          <TodayPlan today={today} />
          <MomentButton today={today} />
          <HelpNow today={today} />
          <NearMe />
        </>
      ) : null}

      {phase === "after" ? <AfterToday /> : null}

      {/* After the trip, open tasks and packing progress are just noise. */}
      {phase !== "after" ? (
        <>
      <FamilyTasks today={today} />
        </>
      ) : null}

      </div>
      <aside className="flex flex-col gap-7 lg:sticky lg:top-20">
      {missing.length ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-extrabold">{tt("whatsMissing")}</h3>
          <ul className="flex flex-col gap-3">
            {missing.map((m) => (
              <MissingCard key={m.id} m={m} base={base} />
            ))}
          </ul>
        </section>
      ) : phase === "before" ? (
        <p className="flex items-center gap-2 font-bold">
          <Icon name="check" className="text-ok" strokeWidth={3} />
          {tt("allGood")}
        </p>
      ) : null}
      {/* Last: it shouldn't push the tasks down (feedback 2026-11-20). */}
      {phase !== "after" ? <PushPrompt /> : null}
      </aside>
    </div>
  );
}
