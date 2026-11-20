import { allCities, type TripProfile } from "../trip-profile";
import { daysBetween } from "../dates";

// What a prompt may know about the trip. Deliberately narrow: no emails,
// addresses, phone numbers, booking codes or member accounts.

export type PromptTraveler = {
  label: string;
  age_group: "infant" | "child" | "teen" | "adult" | "senior";
  birth_year: number | null;
  interests: string[];
};

export type PromptContext = {
  tripName: string;
  startDate: string | null;
  endDate: string | null;
  profile: TripProfile;
  travelers: PromptTraveler[];
  /** Titles already in the target list, so the chat won't repeat them. */
  existing: string[];
  bags: string[];
  today: string;
  /** Phase 2: the plan so far. Bookings carry kind/title/local time only, never confirmation codes. */
  plan?: PromptPlan;
  /** Weather over the trip, per city: "טוקיו: 9°–21°, גשם ב-2 מתוך 5 ימים (תחזית)". */
  weatherSummary?: string[];
  /** Phase 4: what we did and wrote (prompt 11). */
  memories?: PromptMemories;
};

export type PromptMemories = {
  places: { name: string; city: string | null; rating: number | null; note: string | null }[];
  journal: { date: string | null; body: string; rating: number | null }[];
};

export type PromptPlanStop = { label: string; timeOfDay: string | null; start: string | null; minutes: number | null; city: string | null };
export type PromptPlan = {
  days: { date: string; city: string | null; title: string | null; lodgingArea: string | null; lodgingSet?: boolean; stops: PromptPlanStop[]; weather?: string | null }[];
  places: { name: string; city: string | null; area: string | null; category: string; priority: string; status: string }[];
  bookings: { kind: string; title: string; local: string | null }[];
};

const AGE_WORD: Record<PromptTraveler["age_group"], string> = {
  infant: "תינוק",
  child: "ילד",
  teen: "נער",
  adult: "מבוגר",
  senior: "מבוגר מאוד",
};

/** How a traveler is named in prompts: their label, or "מבוגר 1" / "ילד, 8" (SPEC §9 toggle). */
export function travelerNames(ctx: PromptContext): string[] {
  const counters: Record<string, number> = {};
  // Age during the trip (not today), when the dates are known.
  const year = Number((ctx.startDate ?? ctx.today).slice(0, 4));
  return ctx.travelers.map((t) => {
    if (ctx.profile.namesInPrompts) return t.label;
    const word = AGE_WORD[t.age_group];
    counters[word] = (counters[word] ?? 0) + 1;
    if (t.birth_year && (t.age_group === "child" || t.age_group === "teen" || t.age_group === "infant")) {
      return `${word}, ${year - t.birth_year}`;
    }
    return `${word} ${counters[word]}`;
  });
}

const MONTHS_HE = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/** Names for the "for" field, quoted so labels like "ילד, 8" stay unambiguous. */
export function quotedNames(ctx: PromptContext): string {
  const names = travelerNames(ctx);
  return names.length ? names.map((n) => `"${n}"`).join(", ") + `, או "כולם"` : `"כולם"`;
}

export function describeDates(ctx: PromptContext): string {
  if (!ctx.startDate) return "התאריכים עוד לא נקבעו";
  const end = ctx.endDate ?? ctx.startDate;
  const nights = daysBetween(ctx.startDate, end);
  const month = MONTHS_HE[Number(ctx.startDate.slice(5, 7)) - 1];
  return `${ctx.startDate} עד ${end} (${nights} לילות, ${month} ${ctx.startDate.slice(0, 4)})`;
}

/** Cities in itinerary order, with the date range each one covers (from the plan's days). */
export function citiesFromPlan(days: { date: string; city: string | null }[]): { name: string; from: string; to: string }[] {
  const out: { name: string; from: string; to: string }[] = [];
  for (const d of [...days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const name = d.city?.trim();
    if (!name) continue;
    const last = out.at(-1);
    if (last && last.name === name) last.to = d.date;
    else out.push({ name, from: d.date, to: d.date });
  }
  return out;
}

export function describeRoute(ctx: PromptContext): string {
  const p = ctx.profile;
  const planCities = citiesFromPlan(ctx.plan?.days ?? []);
  const fromPlan = planCities.map((c) => (c.from === c.to ? `${c.name} (${c.from})` : `${c.name} (${c.from}–${c.to})`)).join(", ");
  const hasCities = p.destinations.some((d) => d.cities.length > 0);
  if (p.destinations.length === 0) {
    // Nobody filled the profile, but the plan (or the trip's name) already says where we go.
    if (fromPlan) return fromPlan;
    return ctx.tripName ? `לפי שם הטיול: ${ctx.tripName}` : "היעד עוד לא נקבע";
  }
  const route = p.destinations
    .map((d) => {
      const cities = d.cities.map((c) => c.name + (c.from && c.to ? ` (${c.from}–${c.to})` : "")).join(", ");
      return cities ? `${d.country}: ${cities}` : d.country;
    })
    .join("; ");
  return !hasCities && fromPlan ? `${route}: ${fromPlan}` : route;
}

const PACE: Record<string, string> = { relaxed: "רגוע", balanced: "מאוזן", intense: "אינטנסיבי" };
const BUDGET: Record<string, string> = { budget: "חסכוני", mid: "בינוני", luxury: "מפנק" };
const FOOD: Record<string, string> = { vegetarian: "צמחוני", vegan: "טבעוני", kosher: "כשר", no_spicy: "בלי חריף", gluten_free: "בלי גלוטן" };
const TRANSPORT: Record<string, string> = { trains: "רכבות", car: "רכב", walking: "הליכה", taxis: "מוניות" };

export function describeStyle(ctx: PromptContext): string[] {
  const s = ctx.profile.style;
  const lines: string[] = [];
  if (s.pace) lines.push(`קצב: ${PACE[s.pace]}`);
  if (s.budget) lines.push(`תקציב: ${BUDGET[s.budget]}`);
  if (s.food.length) lines.push(`אוכל: ${s.food.map((f) => FOOD[f]).join(", ")}`);
  if (s.transport.length) lines.push(`תחבורה: ${s.transport.map((t) => TRANSPORT[t]).join(", ")}`);
  if (s.notes) lines.push(`הערות: ${s.notes}`);
  return lines;
}

export function describeTravelers(ctx: PromptContext): string {
  const names = travelerNames(ctx);
  if (names.length === 0) return "עוד לא הוגדרו מטיילים";
  return names
    .map((n, i) => {
      const interests = ctx.travelers[i].interests;
      return interests.length ? `${n} (אוהב/ת: ${interests.join(", ")})` : n;
    })
    .join("; ");
}

export function daysLeft(ctx: PromptContext): number | null {
  return ctx.startDate ? daysBetween(ctx.today, ctx.startDate) : null;
}

export function cityCount(ctx: PromptContext): number {
  return allCities(ctx.profile).length;
}
