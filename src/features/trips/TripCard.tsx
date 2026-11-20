import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { Stamp } from "@/components/ui/Stamp";
import { Ticket } from "@/components/ui/Ticket";
import { daysBetween, formatDateRange, formatShortDate, tripDay, tripPhase } from "@/lib/dates";
import type { TripSummary } from "./api";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-ink-2">{label}</span>
      <span className="text-base font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

/** An upcoming or current trip, drawn as a ticket in the trip's own color. */
export function TripCard({ trip, today }: { trip: TripSummary; today: string }) {
  const t = useTranslations("trips");
  const phase = tripPhase(trip, today);
  const style = { "--trip": trip.theme_color } as CSSProperties;

  let stub: ReactNode = null;
  if (trip.start_date && phase === "before") {
    const days = Math.max(0, daysBetween(today, trip.start_date));
    stub =
      days === 0 ? (
        <span className="display text-[2.75rem] text-trip-ink">{t("daysToGo", { days })}</span>
      ) : (
        <span className="flex items-baseline gap-1.5 font-bold">
          {t("more")}
          <span className="display text-[3.25rem] leading-[0.8] text-trip-ink">{days}</span>
          {t("days")}
        </span>
      );
  } else if (trip.start_date && phase === "during") {
    const d = tripDay(trip, today);
    if (d) stub = <span className="display text-[2.75rem] text-trip-ink">{t("dayOf", { day: d.day, total: d.total })}</span>;
  }

  return (
    <Link href={`/trips/${trip.id}/today`} style={style} className="block transition-transform active:translate-y-[2px]">
      <Ticket
        main={
          <div className="relative flex flex-col gap-3 px-4 pb-3 pt-4">
            <span aria-hidden="true" className="halftone absolute -end-8 -top-8 size-32 rounded-full opacity-50" />
            <h3 className="display relative text-[3.4rem]">{trip.name}</h3>
            {trip.start_date ? (
              <div className="relative grid grid-cols-3 gap-2">
                <Field label={t("departure")} value={formatShortDate(trip.start_date)} />
                {trip.end_date ? <Field label={t("return")} value={formatShortDate(trip.end_date)} /> : null}
              </div>
            ) : (
              <p className="relative text-sm text-ink-2">{t("noDates")}</p>
            )}
          </div>
        }
        stub={stub ? <div className="flex min-h-16 items-center px-4 py-2">{stub}</div> : undefined}
      />
    </Link>
  );
}

/** A finished or archived trip: compact, muted, with a "הסתיים" stamp. */
export function PastTripRow({ trip }: { trip: TripSummary }) {
  const t = useTranslations("trips");
  return (
    <Link
      href={`/trips/${trip.id}/today`}
      className="flex items-center justify-between gap-3 border-2 border-ink-3 bg-surface px-4 py-3 text-ink-2 active:bg-surface-2"
    >
      <div className="flex min-w-0 flex-col">
        <span className="display truncate text-[2.1rem] leading-[0.95]">{trip.name}</span>
        {trip.start_date ? <span className="text-sm">{formatDateRange(trip.start_date, trip.end_date)}</span> : null}
      </div>
      <Stamp tone="muted">{t("ended")}</Stamp>
    </Link>
  );
}
