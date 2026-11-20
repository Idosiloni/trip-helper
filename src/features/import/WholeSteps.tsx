"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { showToast } from "@/components/ui/Toast";
import { ageGroupOf, bookingKindKey, type BookingItemT, type ProfileBlockT } from "@/lib/import/whole";
import { keysAfter, lastKey } from "@/lib/position";
import { normalizeForCompare } from "@/lib/text";
import { parseTripProfile, type TripProfile } from "@/lib/trip-profile";
import { isValidTz, wallTimeToUtc } from "@/lib/tz";
import { live } from "../lists/helpers";
import { patchProfile } from "../setup/api";
import { insertRow } from "../trip-data/mutations";
import { useTripData, useTripStore } from "../trip-data/TripDataProvider";

/** Merges imported destinations into the profile: new countries appended, new cities added to known ones. */
export function mergeDestinations(current: TripProfile["destinations"], incoming: ProfileBlockT["destinations"]): TripProfile["destinations"] {
  const out = current.map((d) => ({ ...d, cities: [...d.cities] }));
  for (const d of incoming) {
    const match = out.find((x) => normalizeForCompare(x.country) === normalizeForCompare(d.country));
    const cities = d.cities.map((c) => ({ name: c.name, from: c.from ?? null, to: c.to ?? null, area: c.area ?? "" }));
    if (!match) {
      out.push({ country: d.country, cities });
      continue;
    }
    for (const c of cities) {
      const known = match.cities.find((x) => normalizeForCompare(x.name) === normalizeForCompare(c.name));
      if (!known) match.cities.push(c);
      else if (!known.from && c.from) Object.assign(known, { from: c.from, to: c.to });
    }
  }
  return out.slice(0, 10).map((d) => ({ ...d, cities: d.cities.slice(0, 20) }));
}

type StepProps = { onDone: () => void; onSkip: () => void; footer: (busy: boolean, n: number, run: () => void) => React.ReactNode };

export function ProfileStep({ profile, onDone, footer }: StepProps & { profile: ProfileBlockT }) {
  const t = useTranslations("whole");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const known = new Set(live(snap.travelers).map((x) => normalizeForCompare(x.label)));
  const newTravelers = profile.travelers.filter((x) => !known.has(normalizeForCompare(x.name)));
  const [useDest, setUseDest] = useState(profile.destinations.length > 0);
  const [chosen, setChosen] = useState<Set<number>>(new Set(newTravelers.map((_, i) => i)));
  const [busy, setBusy] = useState(false);
  const [useOverview, setUseOverview] = useState(Boolean(profile.overview));
  const n = (useDest ? 1 : 0) + (useOverview ? 1 : 0) + chosen.size;

  async function run() {
    setBusy(true);
    try {
      if (useDest && profile.destinations.length) {
        const current = parseTripProfile(snap.trip!.profile).destinations;
        await patchProfile(snap.trip!.id, { destinations: mergeDestinations(current, profile.destinations) });
      }
      if (useOverview && profile.overview) await patchProfile(snap.trip!.id, { overview: profile.overview });
      const picked = newTravelers.filter((_, i) => chosen.has(i));
      const positions = keysAfter(lastKey(live(snap.travelers)), picked.length);
      const year = Number((snap.trip!.start_date ?? new Date().toISOString()).slice(0, 4));
      for (const [i, x] of picked.entries()) {
        await insertRow(store, "travelers", {
          label: x.name.slice(0, 40),
          age_group: ageGroupOf(x.age),
          birth_year: x.age !== undefined && x.age < 18 ? year - x.age : null,
          interests: x.interests ?? [],
          position: positions[i],
        });
      }
      await store.load();
      onDone();
    } catch (e) {
      console.error(e);
      showToast({ message: tc("errorGeneric") });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {profile.overview ? (
        <label className="flex cursor-pointer items-start gap-3 border-2 border-ink bg-surface p-3">
          <input type="checkbox" checked={useOverview} onChange={(e) => setUseOverview(e.target.checked)} className="mt-1 size-6 shrink-0 accent-[var(--ink)]" />
          <span className="flex flex-col gap-1">
            <span className="font-extrabold">{t("overview")}</span>
            <span className="text-sm">{profile.overview}</span>
          </span>
        </label>
      ) : null}
      {profile.destinations.length ? (
        <label className="flex cursor-pointer items-start gap-3 border-2 border-ink bg-surface p-3">
          <input type="checkbox" checked={useDest} onChange={(e) => setUseDest(e.target.checked)} className="mt-1 size-6 shrink-0 accent-[var(--ink)]" />
          <span className="flex flex-col gap-1">
            <span className="font-extrabold">{t("destinations")}</span>
            {profile.destinations.map((d) => (
              <span key={d.country} className="text-sm">
                <b>{d.country}</b>
                {d.cities.length ? `: ${d.cities.map((c) => c.name + (c.from ? ` (${c.from}${c.to && c.to !== c.from ? `–${c.to}` : ""})` : "")).join(", ")}` : ""}
              </span>
            ))}
            <span className="text-xs text-ink-2">{t("destinationsHint")}</span>
          </span>
        </label>
      ) : null}
      {profile.travelers.length ? (
        <section className="flex flex-col gap-1">
          <h3 className="font-extrabold">{t("travelers")}</h3>
          {newTravelers.length === 0 ? <p className="text-sm text-ink-2">{t("allTravelersKnown")}</p> : null}
          {newTravelers.map((x, i) => (
            <label key={x.name} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-hair">
              <input
                type="checkbox"
                checked={chosen.has(i)}
                onChange={(e) => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(i);
                  else next.delete(i);
                  setChosen(next);
                }}
                className="size-6 shrink-0 accent-[var(--ink)]"
              />
              <span className="flex-1 font-bold">{x.name}</span>
              {x.age !== undefined ? <span className="text-sm text-ink-2">{t("age", { n: x.age })}</span> : null}
            </label>
          ))}
        </section>
      ) : null}
      {footer(busy, n, () => void run())}
    </div>
  );
}

function toInstant(wall: string | undefined, tz: string | undefined): string | null {
  if (!wall) return null;
  const [date, time] = wall.replace("T", " ").split(" ");
  const zone = tz && isValidTz(tz) ? tz : "Asia/Jerusalem";
  return wallTimeToUtc(date, time ?? "12:00", zone);
}

export function BookingsStep({ items, onDone, footer }: StepProps & { items: BookingItemT[] }) {
  const t = useTranslations("whole");
  const tb = useTranslations("bookings");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const existing = new Set(live(snap.bookings).map((b) => normalizeForCompare(b.title)));
  const [chosen, setChosen] = useState<Set<number>>(new Set(items.map((_, i) => i).filter((i) => !existing.has(normalizeForCompare(items[i].title)))));
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      for (const [i, b] of items.entries()) {
        if (!chosen.has(i)) continue;
        const tz = b.tz && isValidTz(b.tz) ? b.tz : null;
        const endTz = b.end_tz && isValidTz(b.end_tz) ? b.end_tz : tz;
        await insertRow(store, "bookings", {
          kind: bookingKindKey(b.kind),
          // Hebrew reads right to left, so "תל אביב → טוקיו" points backwards: flip it.
          title: /[\u0590-\u05FF]/.test(b.title) ? b.title.replace(/\s*(?:→|->)\s*/g, " ← ") : b.title,
          starts_at: toInstant(b.start, tz ?? undefined),
          starts_tz: tz,
          ends_at: toInstant(b.end, endTz ?? undefined),
          ends_tz: endTz,
          link: b.link ?? null,
          notes: b.note ?? null,
          address: b.address ?? null,
          price: b.price ?? null,
          cancel_by: b.cancel_by ?? null,
          // A hotel that's already on the places list gets linked (navigation, the day's lodging).
          place_id: live(snap.places).find((p) => normalizeForCompare(p.name) === normalizeForCompare(b.title))?.id ?? null,
        });
      }
      onDone();
    } catch (e) {
      console.error(e);
      showToast({ message: tc("errorGeneric") });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{t("bookingsHint")}</p>
      <ul className="flex flex-col border-t-2 border-ink">
        {items.map((b, i) => (
          <li key={i}>
            <label className="flex min-h-14 cursor-pointer items-start gap-3 border-b border-hair py-2">
              <input
                type="checkbox"
                checked={chosen.has(i)}
                onChange={(e) => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(i);
                  else next.delete(i);
                  setChosen(next);
                }}
                className="mt-1 size-6 shrink-0 accent-[var(--ink)]"
              />
              <span className="flex flex-col">
                <span className="font-bold">{b.title}</span>
                <span className="text-sm text-ink-2">{[tb(`kinds.${bookingKindKey(b.kind)}`), b.start, b.end ? `→ ${b.end}` : null].filter(Boolean).join(" · ")}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {footer(busy, chosen.size, () => void run())}
    </div>
  );
}
