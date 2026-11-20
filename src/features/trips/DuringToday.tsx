"use client";

import { ChangePlanButton } from "../itinerary/ChangePlanSheet";
import { ShareDay } from "../itinerary/ShareDay";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { distanceKm, googleMapsDirectionsUrl, type LatLng } from "@/lib/geo";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { live } from "../lists/helpers";
import { located } from "../places/helpers";
import { stopLabel, stopsOfDay } from "../itinerary/helpers";
import { useTripData } from "../trip-data/TripDataProvider";

const LOOKING = ["food", "coffee", "toilet", "rain", "kids", "pharmacy"] as const;

/** Rounds to ~100 m: enough for "what's near", not a precise location (SPEC 9). */
const roundCoord = (n: number) => Math.round(n * 1000) / 1000;

function getPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
    );
  });
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Today's stops in order, each with "navigate" (SPEC §5 during). */
export function TodayPlan({ today }: { today: string }) {
  const t = useTranslations("during");
  const snap = useTripData();
  const base = `/trips/${snap.trip!.id}`;
  const day = snap.days.find((d) => d.date === today);
  const stops = day ? stopsOfDay(snap, day.id) : [];
  return (
    <section className="flex flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
        <h3 className="text-lg font-extrabold">
          {t("todayPlan")}
          {day?.city ? <span className="font-bold text-ink-2"> · {day.city}</span> : null}
        </h3>
        <Link href={day ? `${base}/plan/${today}` : `${base}/plan`} className="text-sm font-bold underline underline-offset-4">
          {stops.length ? t("openDay") : t("planDay")}
        </Link>
      </div>
      {stops.length === 0 ? (
        <p className="py-3 text-sm text-ink-2">{t("noPlanToday")}</p>
      ) : (
        <ol>
          {stops.map((s) => {
            const place = s.place_id ? snap.places.find((p) => p.id === s.place_id) : null;
            const time = s.start_time?.slice(0, 5);
            return (
              <li key={s.id} className="flex min-h-14 items-center gap-3 border-b border-hair">
                <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums text-ink-2">{time ?? ""}</span>
                <span className="flex-1 text-[17px]">{stopLabel(snap, s)}</span>
                {place ? (
                  <a href={googleMapsDirectionsUrl(place)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1 px-2 text-sm font-extrabold underline underline-offset-4">
                    <Icon name="route" size={16} />
                    {t("navigate")}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {stops.length ? (
        <div className="mt-3 flex flex-col gap-2">
          <ChangePlanButton date={today} />
          {day ? <ShareDay day={day} /> : null}
        </div>
      ) : null}
    </section>
  );
}

/** "Near me": asks for location only on tap; nothing is stored. */
export function NearMe() {
  const t = useTranslations("during");
  const snap = useTripData();
  const [state, setState] = useState<"idle" | "locating" | "denied" | "failed" | "ready">("idle");
  const [here, setHere] = useState<LatLng | null>(null);
  const wanted = live(snap.places).filter((p) => p.status === "want").filter(located);
  const near = here
    ? wanted
        .map((p) => ({ p, km: distanceKm(here, { lat: p.lat, lng: p.lng }) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 8)
    : [];

  async function locate() {
    setState("locating");
    try {
      setHere(await getPosition());
      setState("ready");
    } catch (e) {
      setState((e as GeolocationPositionError)?.code === 1 ? "denied" : "failed");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b-2 border-ink pb-1 text-lg font-extrabold">{t("nearMe")}</h3>
      {state !== "ready" ? (
        <>
          <p className="text-sm text-ink-2">{t("nearMeHint")}</p>
          <Button variant="secondary" loading={state === "locating"} icon={<Icon name="pin" size={18} />} onClick={locate}>
            {state === "locating" ? t("locating") : t("findNearMe")}
          </Button>
          {state === "denied" ? <p role="alert" className="text-sm font-bold">{t("locationDenied")}</p> : null}
          {state === "failed" ? <p role="alert" className="text-sm font-bold">{t("locationFailed")}</p> : null}
        </>
      ) : near.length === 0 ? (
        <p className="text-sm text-ink-2">{t("noNearby")}</p>
      ) : (
        <ul>
          {near.map(({ p, km }) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-hair">
              <span className="w-16 shrink-0 text-sm font-extrabold tabular-nums text-ink-2">
                {km < 1 ? t("meters", { n: Math.round(km * 100) * 10 }) : t("km", { n: km.toFixed(1) })}
              </span>
              <Link href={`/trips/${snap.trip!.id}/places?open=${p.id}`} className="flex-1 text-[17px] font-bold">
                {p.name}
              </Link>
              <a href={googleMapsDirectionsUrl(p, "walking")} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center px-2 text-sm font-extrabold underline underline-offset-4">
                {t("navigate")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** "Help now" (prompt 8): what we're looking for + optional rounded location → prompt sheet. */
export function HelpNow({ today }: { today: string }) {
  const t = useTranslations("during");
  const snap = useTripData();
  const openPrompt = useOpenPrompt();
  const [looking, setLooking] = useState<string>("");
  const [other, setOther] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const city = snap.days.find((d) => d.date === today)?.city ?? null;
  const what = other.trim() || (looking ? t(`lookingOptions.${looking as (typeof LOOKING)[number]}`) : "");

  async function make() {
    if (!what) return;
    setError(null);
    let coords: LatLng | null = null;
    if (share) {
      setBusy(true);
      try {
        const p = await getPosition();
        coords = { lat: roundCoord(p.lat), lng: roundCoord(p.lng) };
      } catch (e) {
        setError((e as GeolocationPositionError)?.code === 1 ? t("locationDenied") : t("locationFailed"));
      }
      setBusy(false);
    }
    openPrompt("p08-help-now", { help: { looking: what, time: nowHHMM(), city, coords } });
  }

  return (
    <section className="flex flex-col gap-3 border-2 border-ink bg-surface p-4">
      <h3 className="display text-3xl">{t("helpNow")}</h3>
      <p className="text-sm text-ink-2">{t("helpNowBody")}</p>
      <div role="group" aria-label={t("looking")} className="flex flex-wrap gap-2">
        {LOOKING.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={looking === k && !other.trim()}
            onClick={() => {
              setLooking(k);
              setOther("");
            }}
            className={`min-h-11 border-2 border-ink px-3 text-sm font-bold ${looking === k && !other.trim() ? "bg-ink text-on-ink" : "bg-paper"}`}
          >
            {t(`lookingOptions.${k}`)}
          </button>
        ))}
      </div>
      <TextField label={t("lookingOther")} value={other} maxLength={120} onChange={(e) => setOther(e.target.value)} />
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-1 size-6 shrink-0 accent-[var(--ink)]" />
        <span className="flex flex-col">
          <span className="font-bold">{t("shareLocation")}</span>
          <span className="text-sm text-ink-2">{t("shareLocationHint")}</span>
        </span>
      </label>
      {error ? <p role="alert" className="text-sm font-bold">{error}</p> : null}
      <Button block loading={busy} disabled={!what} icon={<Icon name="copy" size={18} />} onClick={make}>
        {t("makePrompt")}
      </Button>
    </section>
  );
}
