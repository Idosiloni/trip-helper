"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { keysAfter, lastKey } from "@/lib/position";
import { normalizeForCompare } from "@/lib/text";
import { live } from "../lists/helpers";
import { insertRow, patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { hasStay, nightStay, shortDate, stays, type Stay } from "./helpers";

/**
 * Where we sleep, city by city: each stay with its nights, what's set, and one
 * place to pick or type the hotel for all of that stay's nights at once.
 */
export function LodgingScreen() {
  const t = useTranslations("lodging");
  const tc = useTranslations("common");
  const snap = useTripData();
  const base = `/trips/${snap.trip!.id}/plan`;
  const list = stays(snap).filter((s) => s.nights.length);
  const missing = list.reduce((n, s) => n + s.nights.filter((d) => !hasStay(snap, d)).length, 0);

  return (
    <div className="flex flex-col gap-5">
      <SubHeader title={t("title")} backHref={base} backLabel={tc("back")} />
      <p className="text-ink-2">{missing ? t("intro", { n: missing }) : t("allSet")}</p>
      <ul className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        {list.map((s, i) => (
          <StayCard key={s.days[0].id} stay={s} neighbours={[list[i - 1], list[i + 1]].filter((x): x is Stay => Boolean(x))} />
        ))}
      </ul>
    </div>
  );
}

function StayCard({ stay, neighbours }: { stay: Stay; neighbours: Stay[] }) {
  const t = useTranslations("lodging");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const nights = stay.nights.map((d) => ({ day: d, stay: nightStay(snap, d) }));
  const open = nights.filter((n) => !n.stay || n.stay.suggested);
  const names = [...new Set(nights.map((n) => (n.stay ? n.stay.name + (n.stay.suggested ? ` (${t("suggested")})` : "") : null)).filter((x): x is string => Boolean(x)))];
  // Hotels in this city, plus the ones next door (a day trip to Como: you still sleep in Milan).
  const nearby = new Set(neighbours.flatMap((n) => n.nights.map((d) => nightStay(snap, d)?.place?.id).filter((x): x is string => Boolean(x))));
  const inCity = live(snap.places).filter((p) => (p.category === "lodging" && (!p.city || normalizeForCompare(p.city) === normalizeForCompare(stay.city))) || nearby.has(p.id));
  const first = stay.nights[0].date;
  const last = stay.nights.at(-1)!.date;

  async function save(placeId: string | null) {
    const typed = name.trim();
    if (!placeId && !typed) return;
    setBusy(true);
    try {
      let id = placeId;
      if (!id) {
        const known = live(snap.places).find((p) => normalizeForCompare(p.name) === normalizeForCompare(typed));
        id = known?.id ?? (await insertRow(store, "places", { name: typed.slice(0, 120), category: "lodging", city: stay.city, priority: "maybe", position: keysAfter(lastKey(live(snap.places)), 1)[0] })).id;
      }
      // Only the nights without a place to sleep; nights already set stay as they are.
      for (const n of open) await patchRow(store, "days", n.day.id, { lodging_place_id: id });
      setName("");
      showToast({ message: t("saved", { n: open.length }) });
    } catch {
      showToast({ message: tc("errorGeneric") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("flex flex-col gap-3 border-2 bg-surface p-4", open.length ? "border-dashed border-ink" : "border-ink shadow-[3px_3px_0_0_var(--trip-tint)]")}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xl font-extrabold">
          <bdi>{stay.city}</bdi>
        </h3>
        <span className="text-sm font-bold text-ink-2 tabular-nums">
          {shortDate(first)}
          {last !== first ? `–${shortDate(last)}` : ""} · {t("nights", { n: stay.nights.length })}
        </span>
      </div>
      {names.length ? (
        <p className="flex items-start gap-1.5">
          <Icon name="bed" size={17} className="mt-0.5 shrink-0 text-trip-ink" />
          <span className="font-bold">{names.join(" · ")}</span>
        </p>
      ) : null}
      {open.length ? (
        <>
          <p className="text-sm font-bold text-danger">{t("missingNights", { n: open.length, dates: open.map((n) => shortDate(n.day.date)).join(", ") })}</p>
          {canEdit ? (
            <div className="flex flex-col gap-2">
              {inCity.length ? (
                <div className="flex flex-wrap gap-2">
                  {inCity.map((p) => (
                    <button key={p.id} type="button" disabled={busy} onClick={() => void save(p.id)} className="flex min-h-10 items-center gap-1.5 border-2 border-ink bg-paper px-2.5 text-sm font-bold">
                      <Icon name="bed" size={14} />
                      <bdi>{p.name}</bdi>
                    </button>
                  ))}
                </div>
              ) : null}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(null);
                }}
              >
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  aria-label={t("nameLabel", { city: stay.city })}
                  maxLength={120}
                  dir="auto"
                  className="min-h-11 min-w-0 flex-1 border-2 border-ink bg-paper px-3"
                />
                <Button loading={busy} disabled={!name.trim()} type="submit">
                  {t("save")}
                </Button>
              </form>
            </div>
          ) : null}
        </>
      ) : null}
    </li>
  );
}
