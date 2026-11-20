"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import type { GuideDay, GuideStop } from "./guide";

type Part = "morning" | "noon" | "evening";

/** The part of the day a stop belongs to: as the chat set it, else from its time. */
function partOf(s: GuideStop): Part | null {
  if (s.part) return s.part;
  if (!s.time) return null;
  const h = Number(s.time.slice(0, 2));
  return h < 12 ? "morning" : h < 17 ? "noon" : "evening";
}

function StopLine({ s, label }: { s: GuideStop; label: string }) {
  return (
    <li className="print-keep grid grid-cols-[4rem_1fr] gap-x-3 border-b border-hair py-2">
      <span className="pt-0.5 text-sm font-extrabold tabular-nums text-trip-ink">{label}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-extrabold leading-tight">
          {s.mapsUrl ? (
            <a href={s.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-hair underline-offset-4">
              <bdi>{s.name}</bdi>
            </a>
          ) : (
            <bdi>{s.name}</bdi>
          )}
          {s.must ? <span className="ms-1.5 text-trip-ink">★</span> : null}
        </span>
        {s.transport ? (
          <span className="flex items-center gap-1 text-xs font-bold text-ink-2">
            <Icon name="route" size={12} />
            {s.transport}
          </span>
        ) : null}
        {s.note ? <span className="text-[15px] leading-snug text-ink-2">{s.note}</span> : null}
      </span>
    </li>
  );
}

/**
 * One day written out like a travel booklet: its title, what the day is about,
 * the stops by part of the day (or by exact time), where we sleep and plan B.
 * Used by the trip guide and by the plan's "document" view.
 */
export function GuideDayBlock({ d, times, href }: { d: GuideDay; times: boolean; href?: string }) {
  const t = useTranslations("guide");
  const tp = useTranslations("plan");
  const parts = d.stops.map(partOf);
  return (
    <section className="flex flex-col">
      <h3 className="print-keep flex flex-wrap items-baseline gap-x-3 border-b-2 border-ink pb-1">
        <span className="display text-3xl">{t("dayN", { n: d.n })}</span>
        <span className="font-bold text-ink-2">
          {d.label}
          {d.city ? (
            <>
              {" · "}
              <bdi>{d.city}</bdi>
            </>
          ) : null}
        </span>
        {href ? (
          <Link href={href} className="no-print ms-auto flex min-h-9 items-center gap-1 text-sm font-bold underline underline-offset-4">
            {tp("openDay")}
          </Link>
        ) : null}
        {d.title ? <span className="w-full text-xl font-extrabold">{d.title}</span> : null}
      </h3>
      {d.summary ? <p className="mt-2 text-[17px] leading-relaxed">{d.summary}</p> : null}
      {d.stops.length ? (
        <ol className="mt-1">
          {d.stops.map((s, i) => {
            const part = parts[i];
            // Without times, the part of the day is said once, at the start of its block.
            const label = times ? (s.time ?? (part ? tp(`tod.${part}`) : "")) : i === 0 || part !== parts[i - 1] ? (part ? tp(`tod.${part}`) : "") : "";
            return <StopLine key={i} s={s} label={label} />;
          })}
        </ol>
      ) : (
        <p className="mt-2 font-bold text-ink-2">{tp("emptyDay")}</p>
      )}
      {d.stay ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">
          <Icon name="bed" size={15} className="text-trip-ink" />
          {t("sleep")} <bdi>{d.stay}</bdi>
          {d.staySuggested ? ` (${t("suggested")})` : ""}
        </p>
      ) : null}
      {d.planB ? (
        <p className="print-keep mt-2 border-s-4 border-ink-2 ps-3 text-sm">
          <b>{tp("planB")}:</b> {d.planB}
        </p>
      ) : null}
    </section>
  );
}
