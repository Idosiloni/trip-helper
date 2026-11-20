// Time-zone helpers without a library (bookings, SPEC 6.7).
// A booking is entered as wall-clock time in the place's zone ("14:05 in Tokyo")
// and stored as a UTC instant plus the IANA zone name.

const partsCache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a zone. */
export function zonedParts(instant: Date, tz: string) {
  const p = Object.fromEntries(fmt(tz).formatToParts(instant).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** Offset of `tz` from UTC at that instant, in minutes (Tokyo = +540). */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** "2027-04-01" + "14:05" in "Asia/Tokyo" → ISO UTC instant. Handles DST shifts. */
export function wallTimeToUtc(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let off = tzOffsetMinutes(new Date(guess), tz);
  let utc = guess - off * 60000;
  // Re-check with the offset at the result (matters right around a DST change).
  const off2 = tzOffsetMinutes(new Date(utc), tz);
  if (off2 !== off) {
    off = off2;
    utc = guess - off * 60000;
  }
  return new Date(utc).toISOString();
}

/** ISO instant → { date: "YYYY-MM-DD", time: "HH:MM" } as seen in `tz`. */
export function utcToWallTime(iso: string, tz: string): { date: string; time: string } {
  const p = zonedParts(new Date(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** Is this a zone the runtime knows? */
export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const HOME_TZ = "Asia/Jerusalem";

/** Short list for pickers; the full list comes from Intl.supportedValuesOf when available. */
export const COMMON_TZS = [
  "Asia/Jerusalem",
  "Asia/Tokyo",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Istanbul",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export function allTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = intl.supportedValuesOf?.("timeZone") ?? [];
  return Array.from(new Set([...COMMON_TZS, ...list]));
}
