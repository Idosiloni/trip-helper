"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { DayWeather, WeatherKind } from "@/lib/weather";

export const WEATHER_ICON: Record<WeatherKind, IconName> = {
  clear: "sun",
  partly: "cloudSun",
  cloudy: "cloud",
  fog: "cloud",
  drizzle: "rain",
  rain: "rain",
  snow: "snow",
  storm: "rain",
};

/** "☁ 18°/9° · 70%" — small, for day cards and headers. */
export function WeatherChip({ w, long = false, className }: { w: DayWeather; long?: boolean; className?: string }) {
  const t = useTranslations("weather");
  const wet = w.rainChance !== null ? w.rainChance >= 40 : (w.rainMm ?? 0) >= 1;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold tabular-nums", className)} title={t(`kinds.${w.kind}`)}>
      <Icon name={WEATHER_ICON[w.kind]} size={15} aria-hidden="true" className={wet ? "text-c-tasks" : "text-trip-ink"} />
      {long ? null : <span className="sr-only">{t(`kinds.${w.kind}`)}</span>}
      <span dir="ltr">
        {w.max}° / {w.min}°
      </span>
      {w.rainChance !== null && w.rainChance >= 20 ? <span className="text-c-tasks">· {w.rainChance}%</span> : null}
      {long ? <span className="font-normal text-ink-2">· {t(`kinds.${w.kind}`)}{w.source === "lastYear" ? ` · ${t("lastYear")}` : ""}</span> : null}
    </span>
  );
}
