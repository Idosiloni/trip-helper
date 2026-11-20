import { z } from "zod";

// The ```tripdata block every prompt asks the chat to append (SPEC 7.2).
// One schema per kind is the single source of truth: it validates pasted
// answers AND generates the format example embedded in each prompt
// (see example.ts), so the two can't drift apart.
//
// Item schemas are lenient on input (chats are sloppy): numbers may come as
// strings, optional fields may be missing or malformed (then dropped), and
// unknown fields are ignored. Only a missing/empty title rejects an item.

export const KINDS = ["tasks", "packing", "places", "itinerary", "purchases", "notes", "bookings"] as const;
export type Kind = (typeof KINDS)[number];

/** Kinds the app can import today (phases 1-3). */
export const IMPORTABLE_KINDS = ["tasks", "packing", "places", "itinerary", "purchases", "notes"] as const;
export type ImportableKind = (typeof IMPORTABLE_KINDS)[number];

const title = (max: number) => z.string().trim().min(1).max(max);

/** Optional free text: trimmed, cut to `max`, empty → undefined, wrong type → undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v ? v.slice(0, max) : undefined))
    .optional()
    .catch(undefined);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const httpUrl = z
  .string()
  .trim()
  .regex(/^https?:\/\/\S+$/i)
  .max(500)
  .optional()
  .catch(undefined);

export const TaskItem = z.object({
  title: title(200).meta({ example: "להזמין eSIM לכל המשפחה" }),
  note: optionalText(500).meta({ example: "Airalo או Ubigi, חבילה של 10GB" }),
  due: isoDate.meta({ example: "2027-03-20" }),
  for: optionalText(40).meta({ example: "אבא" }),
  phase: z.enum(["before", "during", "after"]).optional().catch(undefined).meta({ example: "before" }),
  link: httpUrl.meta({ example: "https://www.airalo.com" }),
  group: optionalText(60).meta({ example: "תקשורת" }),
});

export const PACKING_CATEGORIES = ["clothing", "toiletries", "documents", "electronics", "meds", "kids", "other"] as const;
export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

export const PackingItem = z.object({
  title: title(120).meta({ example: "מעיל גשם קל" }),
  category: optionalText(30).meta({ example: "ביגוד" }),
  for: optionalText(40).meta({ example: "כולם" }),
  qty: z.coerce.number().int().min(1).max(999).optional().catch(undefined).meta({ example: 4 }),
  note: optionalText(300).meta({ example: "נובמבר בקיוטו, יורד גשם" }),
});

export const PLACE_CATEGORIES = ["food", "attraction", "shopping", "nature", "lodging", "other"] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PlaceItem = z.object({
  name: title(120).meta({ example: "Fushimi Inari Taisha" }),
  category: optionalText(30).meta({ example: "אטרקציה" }),
  city: optionalText(60).meta({ example: "קיוטו" }),
  area: optionalText(60).meta({ example: "Fushimi" }),
  why: optionalText(300).meta({ example: "אלפי שערי טורי כתומים. להגיע מוקדם בבוקר" }),
  priority: z.enum(["must", "maybe"]).optional().catch(undefined).meta({ example: "must" }),
  hours: optionalText(120).meta({ example: "פתוח 24 שעות" }),
  price: z.coerce.number().int().min(0).max(4).optional().catch(undefined).meta({ example: 0 }),
});

const timeOfDay = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => TIME_OF_DAY_ALIASES[v])
  .optional()
  .catch(undefined);

export const ItineraryItem = z.object({
  day: z
    .union([z.coerce.number().int().min(1).max(366), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .meta({ example: "2027-04-03" }),
  time: timeOfDay.meta({ example: "morning" }),
  start: z.string().trim().regex(/^\d{1,2}:\d{2}$/).optional().catch(undefined).meta({ example: "08:00" }),
  place: title(120).meta({ example: "Fushimi Inari Taisha" }),
  city: optionalText(60).meta({ example: "קיוטו" }),
  area: optionalText(60).meta({ example: "Fushimi" }),
  category: optionalText(30).meta({ example: "אטרקציה" }),
  minutes: z.coerce.number().int().min(5).max(1440).optional().catch(undefined).meta({ example: 120 }),
  transport: optionalText(300).meta({ example: "JR Nara Line מתחנת קיוטו, 5 דקות" }),
  note: optionalText(500).meta({ example: "לעלות עד התצפית באמצע ההר. כרטיס לא צריך." }),
  day_title: optionalText(60).meta({ example: "מקדשים ויער במבוק" }),
  day_summary: optionalText(300).meta({ example: "בוקר מוקדם ביער השערים לפני ההמונים, ואחר הצהריים האיילים של נארה." }),
  plan_b: optionalText(600).meta({ example: "בגשם: מוזיאון Kyoto Railway ושוק Nishiki המקורה." }),
  optional: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || (typeof v === "string" && /^(true|yes|כן)$/i.test(v.trim())))
    .optional()
    .catch(undefined)
    .meta({ example: false }),
});

export const PurchaseItem = z.object({
  title: title(200).meta({ example: "קיט-קט מאצ'ה" }),
  for: optionalText(60).meta({ example: "סבתא" }),
  budget: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().slice(0, 40) || undefined)
    .optional()
    .catch(undefined)
    .meta({ example: "עד 20 ש״ח" }),
  where: optionalText(120).meta({ example: "Don Quijote" }),
  note: optionalText(500).meta({ example: "יש גם בדיוטי פרי בנמל התעופה" }),
  link: httpUrl.meta({ example: "https://www.donki.com" }),
});

export const NOTE_KINDS = ["phrase", "tip", "emergency", "money", "etiquette", "general"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const NoteItem = z.object({
  title: title(120).meta({ example: "תודה" }),
  body: optionalText(2000).meta({ example: "אריגאטו גוזאימאס (arigatou gozaimasu)" }),
  kind: optionalText(30).meta({ example: "phrase" }),
});

export const ITEM_SCHEMAS = {
  tasks: TaskItem,
  packing: PackingItem,
  places: PlaceItem,
  itinerary: ItineraryItem,
  purchases: PurchaseItem,
  notes: NoteItem,
} as const;

export type TaskItemT = z.infer<typeof TaskItem>;
export type PackingItemT = z.infer<typeof PackingItem>;
export type PlaceItemT = z.infer<typeof PlaceItem>;
export type ItineraryItemT = z.infer<typeof ItineraryItem>;
export type PurchaseItemT = z.infer<typeof PurchaseItem>;
export type NoteItemT = z.infer<typeof NoteItem>;
export type ItemOf<K extends ImportableKind> = K extends "tasks"
  ? TaskItemT
  : K extends "packing"
    ? PackingItemT
    : K extends "places"
      ? PlaceItemT
      : K extends "purchases"
        ? PurchaseItemT
        : K extends "notes"
          ? NoteItemT
          : ItineraryItemT;

/** The field that names an item (used for plain-string items and duplicate checks). */
export const TITLE_FIELD: Record<ImportableKind, "title" | "name" | "place"> = {
  tasks: "title",
  packing: "title",
  places: "name",
  itinerary: "place",
  purchases: "title",
  notes: "title",
};

export function itemTitle(kind: ImportableKind, item: unknown): string {
  return String((item as Record<string, unknown>)[TITLE_FIELD[kind]] ?? "");
}

export const Envelope = z.object({
  v: z.coerce.number().optional().catch(undefined),
  kind: z.string().trim().toLowerCase(),
  items: z.array(z.unknown()),
});

/** Maps what a chat writes for a category (Hebrew or English) to our keys. */
const CATEGORY_ALIASES: Record<PackingCategory, string[]> = {
  clothing: ["ביגוד", "בגדים", "לבוש", "clothing", "clothes", "apparel"],
  toiletries: ["רחצה", "טואלטיקה", "היגיינה", "קוסמטיקה", "toiletries", "hygiene"],
  documents: ["מסמכים", "ניירת", "documents", "docs", "papers"],
  electronics: ["אלקטרוניקה", "חשמל", "גאדג׳טים", "גאדג'טים", "electronics", "tech", "gadgets"],
  meds: ["תרופות", "עזרה ראשונה", "בריאות", "meds", "medicine", "medications", "health", "first aid"],
  kids: ["ילדים", "תינוק", "לילדים", "kids", "children", "baby"],
  other: ["אחר", "שונות", "כללי", "other", "misc", "general"],
};

const PLACE_CATEGORY_ALIASES: Record<PlaceCategory, string[]> = {
  food: ["אוכל", "מסעדה", "בית קפה", "קפה", "אוכל רחוב", "food", "restaurant", "cafe", "eat", "street food", "bar"],
  attraction: ["אטרקציה", "מוזיאון", "מקדש", "אתר", "תצפית", "attraction", "museum", "temple", "shrine", "sight", "landmark", "viewpoint"],
  shopping: ["קניות", "שוק", "חנות", "קניון", "shopping", "market", "shop", "store", "mall"],
  nature: ["טבע", "פארק", "גן", "חוף", "טיול", "nature", "park", "garden", "beach", "hike", "trail"],
  lodging: ["לינה", "מלון", "דירה", "lodging", "hotel", "hostel", "apartment", "ryokan"],
  other: ["אחר", "other", "misc"],
};

export function placeCategoryKey(raw: string | undefined): PlaceCategory {
  if (!raw) return "attraction";
  const v = raw.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(PLACE_CATEGORY_ALIASES) as [PlaceCategory, string[]][]) {
    if (aliases.some((a) => a.toLowerCase() === v)) return key;
  }
  return "other";
}

const TIME_OF_DAY_ALIASES: Record<string, "morning" | "noon" | "evening" | undefined> = {
  morning: "morning",
  noon: "noon",
  afternoon: "noon",
  midday: "noon",
  evening: "evening",
  night: "evening",
  "בוקר": "morning",
  "צהריים": "noon",
  "צהרים": "noon",
  "אחר הצהריים": "noon",
  "אחה\"צ": "noon",
  "ערב": "evening",
  "לילה": "evening",
};

export function categoryKey(raw: string | undefined): PackingCategory {
  if (!raw) return "other";
  const v = raw.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(CATEGORY_ALIASES) as [PackingCategory, string[]][]) {
    if (aliases.some((a) => a.toLowerCase() === v)) return key;
  }
  return "other";
}

const NOTE_KIND_ALIASES: Record<NoteKind, string[]> = {
  phrase: ["ביטוי", "ביטויים", "מילים", "שפה", "phrase", "phrases", "language", "words"],
  tip: ["טיפ", "טיפים", "tip", "tips", "advice"],
  emergency: ["חירום", "מספרי חירום", "בטיחות", "emergency", "safety", "sos"],
  money: ["כסף", "מטבע", "תשלום", "טיפים למלצרים", "money", "currency", "payment", "tipping"],
  etiquette: ["נימוסים", "מנהגים", "תרבות", "etiquette", "manners", "customs", "culture"],
  general: ["כללי", "אחר", "general", "other", "misc"],
};

export function noteKindKey(raw: string | undefined): NoteKind {
  if (!raw) return "general";
  const v = raw.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(NOTE_KIND_ALIASES) as [NoteKind, string[]][]) {
    if (key === v || aliases.some((a) => a.toLowerCase() === v)) return key;
  }
  return "general";
}
