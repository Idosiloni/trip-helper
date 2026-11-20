// Weather for the trip's days from Open-Meteo (free, no key, no account).
// - Days up to 15 days ahead: the forecast.
// - Further out (or in the past): the same dates last year, as "what it's usually like".
// Only rounded coordinates and dates leave the device; results are cached in kv.

import { kv } from "./offline/kv";

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";
export type DayWeather = {
  date: string;
  kind: WeatherKind;
  max: number;
  min: number;
  /** Forecast: chance of rain (%). Typical: null. */
  rainChance: number | null;
  /** Typical: rain that day last year (mm). */
  rainMm: number | null;
  source: "forecast" | "lastYear";
};

/** WMO weather code → our few kinds. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const minusYear = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`.replace(/-02-29$/, "-02-28");

/** Which dates the forecast covers and which use last year's weather. */
export function splitDates(dates: string[], today: string): { forecast: string[]; lastYear: string[] } {
  const horizon = addDays(today, 15);
  const forecast = dates.filter((d) => d >= today && d <= horizon);
  return { forecast, lastYear: dates.filter((d) => !forecast.includes(d)) };
}

type Daily = { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: number[]; precipitation_sum?: number[] };

async function getJson(url: string): Promise<{ daily?: Daily } | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const round = (n: number) => Math.round(n * 10) / 10;

async function fetchRange(lat: number, lng: number, dates: string[], source: DayWeather["source"]): Promise<DayWeather[]> {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const isLast = source === "lastYear";
  const start = isLast ? minusYear(sorted[0]) : sorted[0];
  const end = isLast ? minusYear(sorted.at(-1)!) : sorted.at(-1)!;
  const daily = isLast ? "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" : "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max";
  const host = isLast ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
  const url = `${host}?latitude=${round(lat)}&longitude=${round(lng)}&daily=${daily}&timezone=auto&start_date=${start}&end_date=${end}`;
  const json = await getJson(url);
  const d = json?.daily;
  if (!d?.time) return [];
  const out: DayWeather[] = [];
  d.time.forEach((t, i) => {
    const date = isLast ? `${Number(t.slice(0, 4)) + 1}${t.slice(4)}` : t;
    if (!dates.includes(date) || d.temperature_2m_max[i] == null) return;
    out.push({
      date,
      kind: weatherKind(d.weather_code[i] ?? 3),
      max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]),
      rainChance: isLast ? null : (d.precipitation_probability_max?.[i] ?? null),
      rainMm: isLast ? (d.precipitation_sum?.[i] ?? null) : null,
      source,
    });
  });
  return out;
}

/** City name → coordinates (Open-Meteo geocoding understands Hebrew names), cached for good. */
export async function geocodeCity(name: string): Promise<{ lat: number; lng: number } | null> {
  const key = `geo:city:${name.trim().toLowerCase()}`;
  const hit = await kv().get<{ lat: number; lng: number } | null>(key);
  if (hit !== undefined) return hit;
  const json = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=1&language=he`)) as { results?: { latitude: number; longitude: number }[] } | null;
  if (!json) return null; // offline: try again later
  const r = json.results?.[0];
  const value = r ? { lat: r.latitude, lng: r.longitude } : null;
  await kv().set(key, value);
  return value;
}

const TTL = { forecast: 3 * 3600_000, lastYear: 30 * DAY };

/** Weather for some dates at one spot, from the device cache when fresh enough. */
export async function weatherFor(lat: number, lng: number, dates: string[], today: string): Promise<DayWeather[]> {
  const key = `weather:${round(lat)},${round(lng)}:${[...dates].sort().join(",")}`;
  const cached = await kv().get<{ at: number; days: DayWeather[] }>(key);
  const fresh = cached && cached.days.every((d) => Date.now() - cached.at < TTL[d.source]);
  if (cached && fresh) return cached.days;
  const { forecast, lastYear } = splitDates(dates, today);
  const [a, b] = await Promise.all([fetchRange(lat, lng, forecast, "forecast"), fetchRange(lat, lng, lastYear, "lastYear")]);
  const days = [...a, ...b];
  if (days.length) await kv().set(key, { at: Date.now(), days });
  // Offline or the service failed: an old copy beats nothing.
  return days.length ? days : (cached?.days ?? []);
}

const KIND_HE: Record<WeatherKind, string> = {
  clear: "בהיר",
  partly: "מעונן חלקית",
  cloudy: "מעונן",
  fog: "ערפל",
  drizzle: "טפטוף",
  rain: "גשם",
  snow: "שלג",
  storm: "סופות רעמים",
};

/** Plain text for prompts: "גשם, 14°–9°, 70% סיכוי לגשם". */
export function weatherText(w: DayWeather): string {
  const parts = [KIND_HE[w.kind], `${w.min}°–${w.max}°`];
  if (w.rainChance !== null && w.rainChance >= 20) parts.push(`${w.rainChance}% סיכוי לגשם`);
  if (w.source === "lastYear") parts.push("לפי אותם תאריכים בשנה שעברה");
  return parts.join(", ");
}
