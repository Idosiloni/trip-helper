"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import type { TripProfile } from "@/lib/trip-profile";

type Destinations = TripProfile["destinations"];

const input = "min-h-12 w-full border-2 border-ink bg-surface px-3 text-base text-ink placeholder:text-ink-3";

/** Countries, each with an ordered list of cities and optional dates (SPEC 6.1). */
export function DestinationsEditor({ value, onChange }: { value: Destinations; onChange: (v: Destinations) => void }) {
  const t = useTranslations("setup");
  const update = (i: number, patch: Partial<Destinations[number]>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="flex flex-col gap-4">
      {value.map((dest, i) => (
        <fieldset key={i} className="flex flex-col gap-3 border-2 border-ink bg-surface p-3">
          <legend className="sr-only">{t("countryN", { n: i + 1 })}</legend>
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm font-bold">{t("country")}</span>
              <input className={input} value={dest.country} placeholder={t("countryPlaceholder")} onChange={(e) => update(i, { country: e.target.value })} />
            </label>
            <button type="button" aria-label={t("removeCountry")} onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-12 place-items-center border-2 border-ink">
              <Icon name="trash" size={20} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">{t("cities")}</span>
            {dest.cities.map((c, k) => (
              <div key={k} className="flex flex-col gap-2 border-t border-hair pt-2">
                <div className="flex gap-2">
                  <input
                    aria-label={t("cityN", { n: k + 1 })}
                    className={input}
                    value={c.name}
                    placeholder={t("cityPlaceholder")}
                    onChange={(e) => update(i, { cities: dest.cities.map((x, m) => (m === k ? { ...x, name: e.target.value } : x)) })}
                  />
                  <button
                    type="button"
                    aria-label={t("removeCity")}
                    onClick={() => update(i, { cities: dest.cities.filter((_, m) => m !== k) })}
                    className="grid size-12 shrink-0 place-items-center"
                  >
                    <Icon name="close" size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs font-bold">
                    {t("from")}
                    <input type="date" className={input} value={c.from ?? ""} onChange={(e) => update(i, { cities: dest.cities.map((x, m) => (m === k ? { ...x, from: e.target.value || null } : x)) })} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-bold">
                    {t("to")}
                    <input type="date" className={input} value={c.to ?? ""} min={c.from ?? undefined} onChange={(e) => update(i, { cities: dest.cities.map((x, m) => (m === k ? { ...x, to: e.target.value || null } : x)) })} />
                  </label>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => update(i, { cities: [...dest.cities, { name: "", from: null, to: null, area: "" }] })}
              className="flex min-h-11 items-center gap-2 self-start font-bold underline underline-offset-4"
            >
              <Icon name="plus" size={18} strokeWidth={3} />
              {t("addCity")}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { country: "", cities: [{ name: "", from: null, to: null, area: "" }] }])}
        className="flex min-h-12 items-center justify-center gap-2 border-2 border-dashed border-ink font-bold"
      >
        <Icon name="plus" size={18} strokeWidth={3} />
        {value.length ? t("addCountry") : t("addFirstCountry")}
      </button>
    </div>
  );
}

/** Drops empty rows before saving. */
export function cleanDestinations(v: Destinations): Destinations {
  return v
    .map((d) => ({ ...d, country: d.country.trim(), cities: d.cities.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name) }))
    .filter((d) => d.country);
}
