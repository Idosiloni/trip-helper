"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/Toast";
import { googleMapsDirectionsUrl } from "@/lib/geo";
import { byPosition, keysAfter, lastKey } from "@/lib/position";
import { normalizeForCompare } from "@/lib/text";
import { live } from "../lists/helpers";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { doubledPlan } from "./duplicates";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Stop, TripDay, TripSnapshot } from "../trip-data/types";
import { dayCity, isLodgingName, nightStay, shortDate, stopLabel, stopsOfDay, weekday } from "./helpers";
import { dayLoad, isJourneyStop, stopTags, type StopTag } from "./insights";

const TAG_STYLE: Record<StopTag["kind"], string> = {
  book: "border-trip-ink text-trip-ink",
  closed: "border-danger text-danger",
  cash: "border-ink-2 text-ink-2",
  early: "border-ink-2 text-ink-2",
  optional: "border-dashed border-ink-2 text-ink-2",
};

export function TagChips({ tags, className }: { tags: StopTag[]; className?: string }) {
  if (!tags.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((x) => (
        <span key={x.kind} className={cn("border px-1.5 text-[11px] font-extrabold leading-5", TAG_STYLE[x.kind])}>
          {x.label}
        </span>
      ))}
    </span>
  );
}

export function placeNoteOf(snap: TripSnapshot, s: Stop) {
  return s.place_id ? (snap.places.find((p) => p.id === s.place_id)?.notes ?? null) : null;
}

/** "About 8 hours · full": a thin bar for how much the day holds (time at stops + getting around). */
export function LoadBar({ stops, className, compact = false }: { stops: Stop[]; className?: string; compact?: boolean }) {
  const t = useTranslations("insights");
  const snap = useTripData();
  // The journey itself (a flight, a long train) and the hotel (check-in, the night) aren't the day's activities.
  const counted = stops
    .map((s) => ({ ...s, label: stopLabel(snap, s), lodging: s.place_id ? snap.places.find((p) => p.id === s.place_id)?.category === "lodging" : false }))
    .filter((s) => !isJourneyStop(s.label) && !s.lodging && !isLodgingName(s.label));
  if (!counted.length) return null;
  const load = dayLoad(counted);
  const total = load.activity + load.travel;
  const width = Math.min(100, (total / (11 * 60)) * 100);
  return (
    <span className={cn("flex items-center gap-2", className)} title={t("loadTitle", { a: Math.round(load.activity / 30) / 2, t: Math.round(load.travel / 30) / 2 })}>
      <span aria-hidden="true" className="h-1.5 w-16 shrink-0 bg-surface-2">
        <span className={cn("block h-full", load.level === "heavy" ? "bg-danger" : load.level === "full" ? "bg-trip" : "bg-ok")} style={{ width: `${width}%` }} />
      </span>
      <span className="whitespace-nowrap text-[11px] font-bold text-ink-2">{t(compact ? "loadShort" : `load.${load.level}`, { h: Math.round((total / 60) * 2) / 2 })}</span>
    </span>
  );
}

type BookItem = { stop: Stop; day: TripDay; name: string; note: string };

function bookAheadItems(snap: TripSnapshot): BookItem[] {
  const out: BookItem[] = [];
  for (const day of [...snap.days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    for (const s of [...stopsOfDay(snap, day.id)].sort(byPosition)) {
      const note = [s.notes, placeNoteOf(snap, s)].filter(Boolean).join(" ");
      if (stopTags(s, placeNoteOf(snap, s)).some((x) => x.kind === "book")) out.push({ stop: s, day, name: stopLabel(snap, s), note });
    }
  }
  return out;
}

/** "What to book ahead": every stop whose note says to book, in trip order, with one tap to make tasks. */
export function BookAheadButton() {
  const t = useTranslations("insights");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = bookAheadItems(snap);
  if (!items.length) return null;
  const taskTitle = (x: BookItem) => t("taskTitle", { name: x.name }).slice(0, 200);
  const existing = new Set(live(snap.tasks).map((x) => normalizeForCompare(x.title)));
  const missing = items.filter((x) => !existing.has(normalizeForCompare(taskTitle(x))));

  async function addAll() {
    setBusy(true);
    try {
      const positions = keysAfter(lastKey(live(snap.tasks)), missing.length);
      for (const [i, x] of missing.entries()) {
        await insertRow(store, "tasks", { title: taskTitle(x), notes: `${shortDate(x.day.date)}: ${x.note}`.slice(0, 2000), position: positions[i], phase: "before" });
      }
      showToast({ message: t("tasksAdded", { n: missing.length }) });
    } catch {
      showToast({ message: tc("errorGeneric") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-1.5 border-2 border-trip-ink bg-surface px-3 text-sm font-extrabold text-trip-ink">
        <Icon name="clock" size={16} />
        {t("bookAhead", { n: items.length })}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("bookAheadTitle")} closeLabel={tc("close")} side>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">{t("bookAheadHint")}</p>
          <ul className="flex flex-col border-t-2 border-ink">
            {items.map((x) => (
              <li key={x.stop.id} className="flex flex-col gap-0.5 border-b border-hair py-2">
                <span className="flex items-baseline gap-2">
                  <span className="text-xs font-extrabold tabular-nums text-trip-ink">{shortDate(x.day.date)}</span>
                  <bdi className="font-extrabold">{x.name}</bdi>
                  {existing.has(normalizeForCompare(taskTitle(x))) ? <Icon name="check" size={14} className="text-ok" aria-label={t("isTask")} /> : null}
                </span>
                <span className="text-sm text-ink-2">{x.note}</span>
              </li>
            ))}
          </ul>
          {canEdit && missing.length ? (
            <button type="button" disabled={busy} onClick={() => void addAll()} className="flex min-h-12 items-center justify-center gap-2 bg-ink font-extrabold text-on-ink disabled:opacity-60">
              <Icon name="plus" size={16} strokeWidth={3} />
              {t("addAsTasks", { n: missing.length })}
            </button>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

/** Computer: a day opened in a side panel next to the table, without leaving the overview. */
export function DayPeek({ day, onClose }: { day: TripDay | null; onClose: () => void }) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const snap = useTripData();
  const base = `/trips/${snap.trip!.id}/plan`;
  const stops = day ? [...stopsOfDay(snap, day.id)].sort(byPosition) : [];
  const stay = day ? nightStay(snap, day) : null;
  const n = day ? snap.days.findIndex((d) => d.id === day.id) + 1 : 0;
  return (
    <Sheet open={day !== null} onClose={onClose} title={day ? t("dayN", { n }) : ""} closeLabel={tc("close")} side>
      {day ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-bold text-ink-2">
              {weekday(day.date)} {shortDate(day.date)}
              {dayCity(snap, day) ? ` · ${dayCity(snap, day)}` : ""}
            </p>
            {day.title ? <p className="text-xl font-extrabold">{day.title}</p> : null}
            <LoadBar stops={stops} />
          </div>
          <ol className="flex flex-col border-t-2 border-ink">
            {stops.map((s) => {
              const place = s.place_id ? snap.places.find((p) => p.id === s.place_id) : null;
              return (
                <li key={s.id} className="flex gap-3 border-b border-hair py-2.5">
                  <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums text-trip-ink">{s.start_time?.slice(0, 5) ?? (s.time_of_day ? t(`tod.${s.time_of_day}`) : "")}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <bdi className="font-extrabold leading-tight">{stopLabel(snap, s)}</bdi>
                    <TagChips tags={stopTags(s, placeNoteOf(snap, s))} />
                    {s.transport_note ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-ink-2">
                        <Icon name="route" size={12} />
                        {s.transport_note}
                      </span>
                    ) : null}
                    {s.notes ? <span className="text-sm text-ink-2">{s.notes}</span> : null}
                  </span>
                  {place ? (
                    <a href={googleMapsDirectionsUrl(place)} target="_blank" rel="noopener noreferrer" aria-label={t("navigate")} className="grid size-10 shrink-0 place-items-center border-2 border-ink">
                      <Icon name="navigate" size={16} />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {stay ? (
            <p className="flex items-center gap-1.5 font-bold">
              <Icon name="bed" size={16} className="text-trip-ink" />
              {stay.name}
              {stay.suggested ? <span className="text-xs font-bold text-danger">({t("suggestedStay")})</span> : null}
            </p>
          ) : null}
          <Link href={`${base}/${day.date}`} className="flex min-h-12 items-center justify-center gap-2 bg-ink font-extrabold text-on-ink">
            {t("openFullDay")}
            <Icon name="chevron" size={16} className="ltr:-scale-x-100" />
          </Link>
        </div>
      ) : null}
    </Sheet>
  );
}

/** "The plan was pasted twice": one tap keeps the newer version (the older stops go to the trash, with undo). */
export function DoubledPlanBanner() {
  const t = useTranslations("doubled");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [busy, setBusy] = useState(false);
  const found = doubledPlan(snap);
  if (!found || !canEdit) return null;

  async function fix() {
    if (!found) return;
    setBusy(true);
    const ids = found.remove.map((s) => s.id);
    try {
      for (const id of ids) await softDelete(store, "stops", id);
      showToast({
        message: t("done", { n: ids.length }),
        actionLabel: t("undo"),
        duration: 10000,
        onAction: () => void Promise.all(ids.map((id) => patchRow(store, "stops", id, { deleted_at: null }))).catch(() => showToast({ message: tc("errorGeneric") })),
      });
    } catch {
      showToast({ message: tc("errorGeneric") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 flex flex-col gap-2 border-2 border-danger bg-surface p-4">
      <p className="font-extrabold">{t("title", { days: found.days })}</p>
      <p className="text-sm text-ink-2">{t("body", { old: found.remove.length, keep: found.keep })}</p>
      <button type="button" disabled={busy} onClick={() => void fix()} className="flex min-h-11 items-center justify-center self-start bg-ink px-4 font-extrabold text-on-ink disabled:opacity-60">
        {busy ? t("working") : t("fix")}
      </button>
    </section>
  );
}
