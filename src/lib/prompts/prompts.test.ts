import { describe, expect, it } from "vitest";
import { parseTripProfile } from "../trip-profile";
import type { PromptContext } from "./context";
import { travelerNames } from "./context";
import { buildPrompt, chatUrl, CHAT_APPS, MAX_PREFILL_URL } from "./registry";
import { redact } from "./redact";

const ctx = (over: Partial<PromptContext> = {}): PromptContext => ({
  tripName: "יפן 2027",
  startDate: "2027-04-01",
  endDate: "2027-04-14",
  profile: parseTripProfile({
    destinations: [{ country: "יפן", cities: [{ name: "טוקיו", from: "2027-04-01", to: "2027-04-05" }, { name: "קיוטו" }] }],
    style: { pace: "balanced", food: ["no_spicy"] },
    luggage: { suitcases: 2, carryOns: 4, weightKg: 23 },
  }),
  travelers: [
    { label: "אבא", age_group: "adult", birth_year: null, interests: ["צילום"] },
    { label: "נועה", age_group: "child", birth_year: 2019, interests: [] },
  ],
  existing: ["מעיל גשם"],
  bags: ["מזוודה גדולה"],
  today: "2026-11-17",
  ...over,
});

describe("prompt templates (snapshots)", () => {
  it.each(["p03-tasks", "p04-packing", "p12-convert"] as const)("%s", (id) => {
    expect(buildPrompt(id, ctx(), { convertKind: "packing" })).toMatchSnapshot();
  });

  it("appends the user's extra request", () => {
    expect(buildPrompt("p04-packing", ctx(), { extra: "בלי ציוד סקי" })).toContain("בקשה נוספת: בלי ציוד סקי");
  });

  it("lists existing items so the chat won't repeat them", () => {
    expect(buildPrompt("p04-packing", ctx())).toContain("- מעיל גשם");
  });
});

const planCtx = () =>
  ctx({
    plan: {
      days: [
        { date: "2027-04-01", city: "טוקיו", title: null, lodgingArea: "Shinjuku", stops: [{ label: "Meiji Shrine", timeOfDay: "morning", start: null, minutes: 90, city: "טוקיו" }] },
        { date: "2027-04-02", city: "טוקיו", title: "יום אנימה", lodgingArea: "Shinjuku", stops: [] },
      ],
      places: [
        { name: "Fushimi Inari Taisha", city: "קיוטו", area: "Fushimi", category: "attraction", priority: "must", status: "want" },
        { name: "Tsukiji Outer Market", city: "טוקיו", area: null, category: "food", priority: "maybe", status: "visited" },
      ],
      bookings: [{ kind: "flight", title: "טיסה לטוקיו", local: "2027-04-01 14:05" }],
    },
  });

describe("phase 2 prompts (snapshots)", () => {
  it("p01 itinerary skeleton", () => expect(buildPrompt("p01-itinerary", planCtx())).toMatchSnapshot());
  it("p02 places for a city", () => expect(buildPrompt("p02-places", planCtx(), { city: "טוקיו" })).toMatchSnapshot());
  it("p07 review", () => expect(buildPrompt("p07-review", planCtx())).toMatchSnapshot());
  it("p10 place question", () =>
    expect(buildPrompt("p10-place", planCtx(), { place: { name: "Fushimi Inari Taisha", city: "קיוטו", area: "Fushimi", date: "2027-04-04", lodgingArea: "Gion" } })).toMatchSnapshot());

  it("p01 lists wanted places and fixed bookings", () => {
    const p = buildPrompt("p01-itinerary", planCtx());
    expect(p).toContain("Fushimi Inari Taisha (קיוטו, Fushimi) · חובה");
    expect(p).not.toContain("Tsukiji"); // already visited
    expect(p).toContain("טיסה לטוקיו (2027-04-01 14:05)");
  });

  it("p01 can target specific days only", () => {
    const p = buildPrompt("p01-itinerary", planCtx(), { onlyDates: ["2027-04-02"] });
    expect(p).toContain("2027-04-02");
    expect(p).not.toContain("Meiji Shrine");
  });

  it("lodging appears only as a neighborhood", () => {
    expect(buildPrompt("p10-place", planCtx(), { place: { name: "x", city: null, area: null, date: null, lodgingArea: "Gion" } })).toContain("באזור Gion");
  });
});

describe("privacy", () => {
  it("uses labels like 'מבוגר 1' / 'ילד, 8' unless names are allowed", () => {
    expect(travelerNames(ctx())).toEqual(["מבוגר 1", "ילד, 8"]); // age in the trip year
    const named = ctx({ profile: { ...ctx().profile, namesInPrompts: true } });
    expect(travelerNames(named)).toEqual(["אבא", "נועה"]);
  });

  it("never leaks emails, phone numbers or booking codes, even if typed into labels", () => {
    const leaky = ctx({
      profile: { ...ctx().profile, namesInPrompts: true },
      travelers: [{ label: "אבא dad@example.com 054-1234567", age_group: "adult", birth_year: null, interests: ["אישור AB12CD"] }],
      existing: ["טיסה LY0091 קוד הזמנה K7XQ2P"],
    });
    for (const id of ["p03-tasks", "p04-packing", "p11-summary"] as const) {
      const p = buildPrompt(id, leaky);
      expect(p).not.toContain("dad@example.com");
      expect(p).not.toContain("054-1234567");
      expect(p).not.toContain("AB12CD");
      expect(p).not.toContain("K7XQ2P");
      expect(p).toContain("2027-04-01"); // dates survive
    }
  });

  it("redact keeps ordinary text and dates", () => {
    expect(redact("טיסה ב-2027-04-01, 4 מטיילים, 23 ק\"ג")).toBe("טיסה ב-2027-04-01, 4 מטיילים, 23 ק\"ג");
  });
});

describe("chatUrl", () => {
  it("prefills short prompts and falls back to an empty chat for long ones", () => {
    const gpt = CHAT_APPS[0];
    expect(chatUrl(gpt, "שלום")).toBe("https://chatgpt.com/?q=%D7%A9%D7%9C%D7%95%D7%9D");
    expect(chatUrl(gpt, "א".repeat(MAX_PREFILL_URL))).toBe("https://chatgpt.com/");
  });
});

describe("phase 3 prompts", () => {
  it("p05 gifts", () => expect(buildPrompt("p05-gifts", ctx())).toMatchSnapshot());
  it("p06 notes", () => expect(buildPrompt("p06-notes", ctx())).toMatchSnapshot());
  it("p08 help now with rounded location and today's plan", () => {
    const text = buildPrompt("p08-help-now", { ...planCtx(), today: "2027-04-01" }, {
      help: { looking: "מקום לאכול", time: "13:10", city: "טוקיו", coords: { lat: 35.6762, lng: 139.6503 } },
    });
    expect(text).toContain("מחפשים: מקום לאכול");
    expect(text).toContain("35.676, 139.650 (טוקיו)");
    expect(text).toContain("Meiji Shrine");
    expect(text).toContain('"kind": "places"');
  });
  it("p08 without location falls back to the city", () => {
    const text = buildPrompt("p08-help-now", planCtx(), { help: { looking: "קפה", time: "09:00", city: "קיוטו", coords: null } });
    expect(text).toContain("איפה אנחנו: קיוטו");
  });
  it("p09 asks for that one day only", () => {
    const text = buildPrompt("p09-change-plan", planCtx(), { date: "2027-04-01", reason: "יורד גשם" });
    expect(text).toContain("הסיבה: יורד גשם");
    expect(text).toContain("Meiji Shrine");
    expect(text).not.toContain("יום אנימה");
    expect(text).toContain('"kind": "itinerary"');
  });
});

describe("phase 4a prompts", () => {
  it("takes the destination from the plan when the profile has none", () => {
    const c = { ...planCtx(), profile: parseTripProfile({}) };
    const text = buildPrompt("p03-tasks", c);
    expect(text).not.toContain("היעד עוד לא נקבע");
    expect(text).toContain("טוקיו (2027-04-01–2027-04-02)");
  });
  it("falls back to the trip name when there's no plan either", () => {
    expect(buildPrompt("p03-tasks", ctx({ profile: parseTripProfile({}) }))).toContain("לפי שם הטיול: יפן 2027");
  });
  const memCtx = () => ({
    ...planCtx(),
    memories: {
      places: [{ name: "Tsukiji Outer Market", city: "טוקיו", rating: 5, note: "הטונה הכי טובה" }],
      journal: [
        { date: "2027-04-02", body: "נועה ראתה צבי בפעם הראשונה", rating: 4 },
        { date: null, body: "מייל: mom@example.com, טלפון 054-7654321", rating: null },
      ],
    },
  });
  it("p11 journal summary", () => expect(buildPrompt("p11-summary", memCtx())).toMatchSnapshot());
  it("p11 includes visited places, ratings and journal text", () => {
    const text = buildPrompt("p11-summary", memCtx());
    expect(text).toContain("Tsukiji Outer Market, טוקיו (5/5): הטונה הכי טובה");
    expect(text).toContain("2027-04-02: נועה ראתה צבי בפעם הראשונה (4/5)");
    expect(text).not.toContain("mom@example.com");
    expect(text).not.toContain("054-7654321");
  });
  it("p11 post style is short and shareable", () => {
    expect(buildPrompt("p11-summary", memCtx(), { summaryStyle: "post" })).toContain("פוסט");
  });
  it("p11 works with no memories yet", () => {
    expect(buildPrompt("p11-summary", ctx())).toContain("סיכום של הטיול");
  });
  it("p13 embeds the plan, asks for every part and strips codes", () => {
    const text = buildPrompt("p13-whole-plan", ctx(), { planText: "טסים 1.4 לטוקיו, אישור טיסה K7XQ2P. יום 2: Meiji Jingu" });
    expect(text).toContain("Meiji Jingu");
    expect(text).not.toContain("K7XQ2P");
    for (const k of ["profile", "places", "itinerary", "bookings", "tasks"]) expect(text).toContain(`"kind": "${k}"`);
  });
  it("p14 embeds the emails, asks for one bookings block and strips codes", () => {
    const text = buildPrompt("p14-bookings", ctx(), { planText: "Booking ref K7XQ2P. Flight LY91 departs TLV 31 Mar 22:30" });
    expect(text).toContain("LY91");
    expect(text).not.toContain("K7XQ2P");
    expect(text).toContain('"kind": "bookings"');
  });
  it("adds the day's weather to the plan and to help-now", () => {
    const c = planCtx();
    c.plan!.days[0] = { ...c.plan!.days[0], weather: "גשם, 9°–14°, 80% סיכוי לגשם" };
    expect(buildPrompt("p09-change-plan", { ...c, today: "2027-04-01" }, { date: "2027-04-01", reason: "גשם" })).toContain("מזג אוויר: גשם, 9°–14°");
    expect(buildPrompt("p08-help-now", { ...c, today: "2027-04-01" }, { help: { looking: "קפה", time: "10:00", city: "טוקיו", coords: null } })).toContain("מזג האוויר היום: גשם");
  });
  it("redact keeps Israeli-style dates and times but removes phones", () => {
    const out = redact("4.12 - 8.12 טוקיו, 14.12.2026 קיוטו, 12:30 - 14:00, 2027-04-01 עד 2027-04-05, טלפון 054-1234567, +972 54 765 4321");
    expect(out).toContain("4.12 - 8.12");
    expect(out).toContain("14.12.2026");
    expect(out).toContain("12:30 - 14:00");
    expect(out).toContain("2027-04-01");
    expect(out).not.toContain("1234567");
    expect(out).not.toContain("765 4321");
  });
  it("p04 packs for the expected weather", () => {
    const text = buildPrompt("p04-packing", ctx({ weatherSummary: ["טוקיו: 5°–12°, גשם או שלג ב-3 מתוך 4 ימים (תחזית)"] }));
    expect(text).toContain("- טוקיו: 5°–12°, גשם או שלג ב-3 מתוך 4 ימים");
    expect(text).toContain("לפי מזג האוויר שלמעלה");
  });
});
