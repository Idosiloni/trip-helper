"use client";

import { useTranslations } from "next-intl";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { copyText } from "../prompts/clipboard";
import { useTripData } from "../trip-data/TripDataProvider";
import { buildSummary, summaryText } from "./summary";

function Stars({ n }: { n: number }) {
  const t = useTranslations("journal");
  return (
    <span className="shrink-0 text-trip-ink">
      <span aria-hidden="true">{"★".repeat(n)}</span>
      <span className="sr-only">{t("stars", { n })}</span>
    </span>
  );
}

/** The whole trip in one look, to hand to someone flying to the same place. */
export function SummaryScreen() {
  const t = useTranslations("summary");
  const tc = useTranslations("common");
  const tp = useTranslations("places");
  const snap = useTripData();
  const base = `/trips/${snap.trip!.id}`;
  const s = buildSummary(snap);
  const empty = !s.days.length && !s.byCity.length && !s.tips.length;

  const text = () =>
    summaryText(s, {
      route: t("route"),
      plan: t("plan"),
      favorites: t("favorites"),
      places: t("places"),
      tips: t("tips"),
      otherCity: t("otherCity"),
      day: (n) => t("day", { n }),
    });

  async function copy() {
    showToast({ message: (await copyText(text())) ? t("copied") : tc("errorGeneric") });
  }
  async function share() {
    try {
      await navigator.share({ title: s.name, text: text() });
    } catch {
      // Cancelled, or no share sheet: copying is the fallback.
    }
  }
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="flex flex-col gap-6">
      <SubHeader title={t("title")} backHref={`${base}/today`} backLabel={tc("back")} />
      <p className="text-ink-2">{t("intro")}</p>
      <div className="flex gap-2">
        <Button className="flex-1" icon={<Icon name="copy" size={18} />} onClick={copy}>
          {t("copy")}
        </Button>
        {canShare ? (
          <Button variant="secondary" className="flex-1" icon={<Icon name="share" size={18} />} onClick={share}>
            {t("share")}
          </Button>
        ) : null}
      </div>

      <section className="flex flex-col gap-1 border-2 border-ink bg-surface p-4">
        <h2 className="display text-4xl">{s.name}</h2>
        {s.dates ? <p className="font-bold text-ink-2">{s.dates}</p> : null}
        {s.route.length ? <p className="text-lg font-extrabold">{s.route.join(" ← ")}</p> : null}
      </section>

      {empty ? <EmptyState icon="route" title={t("emptyTitle")} body={t("emptyBody")} /> : null}

      {s.favorites.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="border-b-2 border-ink pb-1 text-lg font-extrabold">{t("favorites")}</h3>
          <ul className="flex flex-col">
            {s.favorites.map((f) => (
              <li key={f.name} className="flex min-h-11 items-center gap-2 border-b border-hair py-1.5">
                <span className="flex-1 text-[17px] font-bold">
                  {f.name}
                  {f.city ? <span className="font-normal text-ink-2"> · {f.city}</span> : null}
                </span>
                <Stars n={f.rating} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s.days.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="border-b-2 border-ink pb-1 text-lg font-extrabold">{t("plan")}</h3>
          <ol className="flex flex-col">
            {s.days.map((d, i) => (
              <li key={d.date} className="flex gap-3 border-b border-hair py-2">
                <span className="display w-9 shrink-0 text-3xl leading-none tabular-nums">{i + 1}</span>
                <span className="flex flex-col">
                  <span className="font-extrabold">
                    {[d.city, d.title].filter(Boolean).join(" · ") || t("day", { n: i + 1 })}
                  </span>
                  {d.stops.length ? <span className="text-ink-2">{d.stops.join(" · ")}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {s.byCity.map((g) => (
        <section key={g.city} className="flex flex-col gap-2">
          <h3 className="border-b-2 border-ink pb-1 text-lg font-extrabold">
            {t("places")}
            {g.city ? ` · ${g.city}` : ""}
          </h3>
          <ul className="flex flex-col gap-2">
            {g.places.map((p) => (
              <li key={p.name} className="flex flex-col gap-0.5 border-b border-hair pb-2">
                <span className="flex items-center gap-2">
                  <span className="flex-1 text-[17px] font-bold">{p.name}</span>
                  <span className="text-xs font-bold text-ink-2">{tp(`categories.${p.category}`)}</span>
                  {p.rating ? <Stars n={p.rating} /> : null}
                </span>
                {p.note ? <span className="whitespace-pre-line text-ink-2">{p.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {s.tips.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="border-b-2 border-ink pb-1 text-lg font-extrabold">{t("tips")}</h3>
          <ul className="flex flex-col gap-2">
            {s.tips.map((x) => (
              <li key={x.title} className="flex flex-col">
                <span className="font-bold">{x.title}</span>
                {x.body ? <span className="whitespace-pre-line text-ink-2">{x.body}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
