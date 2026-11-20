"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { CATEGORY_COLORS } from "../map/colors";
import { useTripData } from "../trip-data/TripDataProvider";
import { buildGuide } from "./guide";
import { GuideDayBlock } from "./GuideDay";
import { usePlanPrefs } from "../itinerary/plan-prefs";

/**
 * The trip guide: the whole trip as one tidy document. On screen it reads like
 * a travel booklet; "print" gives paper or a PDF to send to anyone.
 */
export function GuideScreen() {
  const t = useTranslations("guide");
  const tp = useTranslations("places");
  const tn = useTranslations("notes");
  const snap = useTripData();
  const g = buildGuide(snap);
  const base = `/trips/${snap.trip!.id}`;
  const planned = g.days.filter((d) => d.stops.length || d.title);
  const { times } = usePlanPrefs();

  return (
    <article className="flex flex-col gap-8 pb-10 print:gap-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href={`${base}/settings`} className="flex min-h-11 items-center gap-1 font-bold">
          <Icon name="back" size={20} className="rtl:-scale-x-100" />
          {t("back")}
        </Link>
        <button type="button" onClick={() => window.print()} className="flex min-h-12 items-center gap-2 bg-ink px-4 font-extrabold text-on-ink">
          <Icon name="share" size={18} />
          {t("print")}
        </button>
      </div>
      <p className="no-print -mt-4 text-sm text-ink-2">{t("printHint")}</p>

      {/* Cover */}
      <header className="relative overflow-hidden border-2 border-ink bg-surface p-5 shadow-[5px_5px_0_0_var(--trip)] print:shadow-none">
        <span aria-hidden="true" className="halftone absolute -end-10 -top-10 size-44 rounded-full opacity-40" />
        <p className="relative text-sm font-extrabold text-trip-ink">{t("kicker")}</p>
        <h1 className="display relative mt-1 text-[3.6rem]">{g.name}</h1>
        <p className="relative mt-2 font-bold text-ink-2">
          {[g.dates, g.nights ? t("nights", { n: g.nights }) : null].filter(Boolean).join(" · ")}
        </p>
        {g.route.length ? (
          <ol className="relative mt-4 flex flex-wrap gap-2">
            {g.route.map((r) => (
              <li key={r.city} className="border-2 border-ink bg-paper px-2.5 py-1">
                <span className="font-extrabold">
                  <bdi>{r.city}</bdi>
                </span>
                <span className="ms-1.5 text-xs font-bold text-ink-2 tabular-nums">
                  {Number(r.from.slice(8))}.{Number(r.from.slice(5, 7))}
                  {r.to !== r.from ? `–${Number(r.to.slice(8))}.${Number(r.to.slice(5, 7))}` : ""}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        {g.overview ? <p className="relative mt-4 max-w-prose text-[17px] leading-relaxed">{g.overview}</p> : null}
      </header>

      {/* The trip at a glance */}
      {planned.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="display text-[2.4rem]">{t("glance")}</h2>
          <table className="w-full border-collapse border-2 border-ink bg-surface text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-surface-2 text-start">
                <th className="p-2 text-start">{t("day")}</th>
                <th className="p-2 text-start">{t("city")}</th>
                <th className="p-2 text-start">{t("what")}</th>
              </tr>
            </thead>
            <tbody>
              {g.days.map((d) => (
                <tr key={d.date} className="print-keep border-b border-hair align-top">
                  <td className="whitespace-nowrap p-2 font-bold">
                    {d.n}. {d.label.replace("יום ", "")}
                  </td>
                  <td className="p-2 font-bold">{d.city ? <bdi>{d.city}</bdi> : ""}</td>
                  <td className="p-2">{d.title ?? d.stops.slice(0, 3).map((s) => s.name).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {/* Day by day */}
      {planned.length ? (
        <section className="print-break flex flex-col gap-5">
          <h2 className="display text-[2.4rem]">{t("dayByDay")}</h2>
          {planned.map((d) => (
            <GuideDayBlock key={d.date} d={d} times={times} />
          ))}
        </section>
      ) : null}

      {/* Places, city by city */}
      {g.cities.length ? (
        <section className="print-break flex flex-col gap-5">
          <h2 className="display text-[2.4rem]">{t("recommended")}</h2>
          {g.cities.map((c) => (
            <section key={c.city || "_"} className="flex flex-col gap-2">
              <h3 className="border-b-2 border-ink pb-1 text-xl font-extrabold">{c.city ? <bdi>{c.city}</bdi> : t("noCity")}</h3>
              {c.stays.length ? (
                <p className="flex items-start gap-1.5 text-sm">
                  <Icon name="bed" size={15} className="mt-0.5 shrink-0 text-trip-ink" />
                  <span>
                    <b>{t("stays")}</b> {c.stays.join(" · ")}
                  </span>
                </p>
              ) : null}
              <ul className="grid gap-x-6 sm:grid-cols-2 print:grid-cols-2">
                {c.places.map((p) => (
                  <li key={p.name} className="print-keep flex gap-2 border-b border-hair py-1.5">
                    <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[p.category] }} />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-bold leading-tight">
                        <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-hair underline-offset-4">
                          <bdi>{p.name}</bdi>
                        </a>
                        {p.must ? <span className="ms-1 text-trip-ink">★</span> : null}
                        {p.rating ? <span className="ms-1 text-xs text-trip-ink">{"●".repeat(p.rating)}</span> : null}
                      </span>
                      <span className="text-xs text-ink-2">{[tp(`categories.${p.category}`), p.area].filter(Boolean).join(" · ")}</span>
                      {p.note ? <span className="text-sm leading-snug text-ink-2">{p.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      ) : null}

      {/* Tips */}
      {g.tips.length ? (
        <section className="print-break flex flex-col gap-3">
          <h2 className="display text-[2.4rem]">{t("tips")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
            {g.tips.map((x, i) => (
              <li key={i} className="print-keep border-2 border-ink bg-surface p-3">
                <span className="text-xs font-extrabold text-trip-ink">{tn(`kinds.${x.kind as "tip"}`)}</span>
                <p className="font-extrabold">{x.title}</p>
                {x.body ? <p className="whitespace-pre-line text-sm text-ink-2">{x.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-ink-3">{t("footer")}</p>
    </article>
  );
}
