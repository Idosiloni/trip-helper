import { z } from "zod";

// trips.profile (jsonb), the context every prompt is built from (SPEC 6.1).
// Lenient on read: unknown/missing fields fall back to defaults.

export const PACES = ["relaxed", "balanced", "intense"] as const;
export const BUDGETS = ["budget", "mid", "luxury"] as const;
export const FOOD = ["vegetarian", "vegan", "kosher", "no_spicy", "gluten_free"] as const;
export const TRANSPORT = ["trains", "car", "walking", "taxis"] as const;

const City = z.object({
  name: z.string().trim().min(1).max(60),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  area: z.string().trim().max(60).default(""),
});

const Destination = z.object({
  country: z.string().trim().min(1).max(60),
  cities: z.array(City).max(20).default([]),
});

export const TripProfileSchema = z.object({
  destinations: z.array(Destination).max(10).default([]),
  style: z
    .object({
      pace: z.enum(PACES).nullable().default(null),
      budget: z.enum(BUDGETS).nullable().default(null),
      food: z.array(z.enum(FOOD)).default([]),
      transport: z.array(z.enum(TRANSPORT)).default([]),
      notes: z.string().max(300).default(""),
    })
    .default({ pace: null, budget: null, food: [], transport: [], notes: "" }),
  luggage: z
    .object({
      suitcases: z.number().int().min(0).max(20).default(0),
      carryOns: z.number().int().min(0).max(20).default(0),
      weightKg: z.number().min(0).max(100).nullable().default(null),
    })
    .default({ suitcases: 0, carryOns: 0, weightKg: null }),
  // The trip in a paragraph: its character and why the route goes this way ("route logic").
  overview: z.string().max(2000).default(""),
  answerLanguage: z.enum(["he", "en"]).default("he"),
  namesInPrompts: z.boolean().default(false),
});

export type TripProfile = z.infer<typeof TripProfileSchema>;
export type TripCity = z.infer<typeof City>;

export function parseTripProfile(raw: unknown): TripProfile {
  const result = TripProfileSchema.safeParse(raw ?? {});
  return result.success ? result.data : TripProfileSchema.parse({});
}

export function allCities(profile: TripProfile): TripCity[] {
  return profile.destinations.flatMap((d) => d.cities);
}
