import { z } from "zod";
import { IMPORTABLE_KINDS, ITEM_SCHEMAS, placeCategoryKey, TITLE_FIELD, type ImportableKind, type ItemOf, type PlaceItemT } from "../tripdata/schemas";
import { isJourneyStop } from "@/features/itinerary/insights";
import { fencedBlocks, tryParse } from "./parse";

// A whole existing trip plan, converted by prompt 13 into several ```tripdata
// blocks: profile, places, itinerary, bookings, tasks, packing, notes.
// Each block is validated on its own; a bad block is skipped, not fatal.

const text = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v ? v.slice(0, max) : undefined))
    .optional()
    .catch(undefined);
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export const ProfileCity = z.object({ name: z.string().trim().min(1).max(60), from: date, to: date, area: text(60) });
export const ProfileBlock = z.object({
  overview: text(2000),
  destinations: z
    .array(z.object({ country: z.string().trim().min(1).max(60), cities: z.array(ProfileCity.catch(undefined as never)).default([]).catch([]) }).catch(undefined as never))
    .default([])
    .catch([]),
  travelers: z
    .array(
      z
        .object({
          name: z.string().trim().min(1).max(40),
          age: z.coerce.number().int().min(0).max(120).optional().catch(undefined),
          interests: z.array(z.string().trim().min(1).max(40)).max(10).optional().catch(undefined),
        })
        .catch(undefined as never),
    )
    .default([])
    .catch([]),
});
export type ProfileBlockT = z.infer<typeof ProfileBlock>;

export const BOOKING_KINDS = ["flight", "hotel", "train", "attraction", "car", "other"] as const;
const BOOKING_ALIASES: Record<(typeof BOOKING_KINDS)[number], string[]> = {
  flight: ["flight", "טיסה", "plane"],
  hotel: ["hotel", "מלון", "לינה", "lodging", "ryokan", "apartment", "airbnb", "דירה"],
  train: ["train", "רכבת", "shinkansen", "bus", "אוטובוס", "ferry", "מעבורת"],
  attraction: ["attraction", "אטרקציה", "ticket", "כרטיס", "tour", "סיור", "מוזיאון"],
  car: ["car", "רכב", "rental", "השכרה"],
  other: ["other", "אחר"],
};
export function bookingKindKey(raw: string | undefined): (typeof BOOKING_KINDS)[number] {
  const v = raw?.trim().toLowerCase() ?? "";
  for (const [k, aliases] of Object.entries(BOOKING_ALIASES)) if (aliases.includes(v)) return k as (typeof BOOKING_KINDS)[number];
  return "other";
}

const wall = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}([ T]\d{1,2}:\d{2})?$/)
  .optional()
  .catch(undefined);
export const BookingItem = z.object({
  kind: text(30),
  title: z.string().trim().min(1).max(120),
  start: wall,
  end: wall,
  tz: text(60),
  end_tz: text(60),
  link: z.string().trim().regex(/^https?:\/\/\S+$/i).max(500).optional().catch(undefined),
  note: text(500),
  address: text(300),
  price: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().slice(0, 60) || undefined)
    .optional()
    .catch(undefined),
  cancel_by: date,
});
export type BookingItemT = z.infer<typeof BookingItem>;

export type WholePart =
  | { kind: "profile"; profile: ProfileBlockT }
  | { kind: "bookings"; items: BookingItemT[] }
  | { kind: ImportableKind; items: ItemOf<ImportableKind>[]; data: unknown };

/**
 * The order parts are imported in: places before the plan that refers to them,
 * and bookings before the plan, so the plan's hotels can be checked against them.
 */
export const WHOLE_ORDER = ["profile", "places", "bookings", "itinerary", "tasks", "packing", "notes", "purchases"] as const;

function itemsOf(value: unknown): { kind: string; value: Record<string, unknown> } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const kind = typeof v.kind === "string" ? v.kind.trim().toLowerCase() : "";
  return kind ? { kind, value: v } : null;
}

export function parseWholePlan(input: string): WholePart[] {
  const parts = new Map<string, WholePart>();
  for (const block of fencedBlocks(input.trim())) {
    const parsed = tryParse(block.text);
    if (!parsed.ok) continue;
    const env = itemsOf(parsed.value);
    if (!env || parts.has(env.kind)) continue;
    if (env.kind === "profile") {
      const r = ProfileBlock.safeParse(env.value.profile ?? env.value);
      if (r.success) {
        const profile = {
          overview: r.data.overview,
          destinations: r.data.destinations.filter(Boolean).map((d) => ({ ...d, cities: d.cities.filter(Boolean) })),
          travelers: r.data.travelers.filter(Boolean),
        };
        if (profile.destinations.length || profile.travelers.length || profile.overview) parts.set("profile", { kind: "profile", profile });
      }
      continue;
    }
    const raw = Array.isArray(env.value.items) ? env.value.items : [];
    if (env.kind === "bookings") {
      const items = raw.map((x) => BookingItem.safeParse(x)).filter((r) => r.success).map((r) => r.data!);
      if (items.length) parts.set("bookings", { kind: "bookings", items });
      continue;
    }
    if (!(IMPORTABLE_KINDS as readonly string[]).includes(env.kind)) continue;
    const kind = env.kind as ImportableKind;
    const items = raw
      .map((x) => ITEM_SCHEMAS[kind].safeParse(typeof x === "string" ? { [TITLE_FIELD[kind]]: x } : x))
      .filter((r) => r.success)
      .map((r) => r.data as ItemOf<ImportableKind>)
      // Flights and trains are bookings or plan lines, not places to visit.
      .filter((x) => kind !== "places" || !isTransportItem(x as PlaceItemT));
    if (items.length) parts.set(kind, { kind, items, data: parsed.value });
  }
  return WHOLE_ORDER.filter((k) => parts.has(k)).map((k) => parts.get(k)!);
}

export function ageGroupOf(age: number | undefined): "infant" | "child" | "teen" | "adult" | "senior" {
  if (age === undefined) return "adult";
  if (age < 2) return "infant";
  if (age < 13) return "child";
  if (age < 18) return "teen";
  if (age < 70) return "adult";
  return "senior";
}

/** A "place" that is really a journey: a flight, a train, the landing at home. */
export function isTransportItem(p: PlaceItemT): boolean {
  const cat = placeCategoryKey(p.category);
  return cat !== "food" && cat !== "lodging" && isJourneyStop(p.name);
}
