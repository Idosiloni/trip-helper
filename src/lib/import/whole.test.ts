import { describe, expect, it } from "vitest";
import { ageGroupOf, bookingKindKey, parseWholePlan } from "./whole";

const answer = `סידרתי את התוכנית שלכם.

\`\`\`tripdata
{ "v": 1, "kind": "profile", "destinations": [{ "country": "יפן", "cities": [{ "name": "טוקיו", "from": "2027-04-01", "to": "2027-04-04" }, { "name": "קיוטו" }] }],
  "travelers": [{ "name": "אבא" }, { "name": "נועה", "age": 8, "interests": ["אנימה"] }] }
\`\`\`

\`\`\`tripdata
{ "v": 1, "kind": "itinerary", "items": [{ "day": "2027-04-01", "time": "evening", "place": "Shibuya Crossing", "city": "טוקיו" }] }
\`\`\`

\`\`\`tripdata
{ "v": 1, "kind": "places", "items": [{ "name": "Shibuya Crossing", "category": "אטרקציה", "city": "טוקיו" }, { "nope": 1 }] }
\`\`\`

\`\`\`tripdata
{ "v": 1, "kind": "bookings", "items": [{ "kind": "טיסה", "title": "TLV → NRT", "start": "2027-03-31 22:30", "tz": "Asia/Jerusalem", "end": "2027-04-01 17:00", "end_tz": "Asia/Tokyo" }, { "title": "" }] }
\`\`\`

\`\`\`tripdata
{ "v": 1, "kind": "tasks", "items": ["להזמין eSIM", { "title": "ביטוח" }] }
\`\`\`

\`\`\`tripdata
{ "v": 1, "kind": "weather", "items": [1] }
\`\`\`
`;

describe("whole plan import", () => {
  it("splits an answer into parts, in import order", () => {
    const parts = parseWholePlan(answer);
    expect(parts.map((p) => p.kind)).toEqual(["profile", "places", "bookings", "itinerary", "tasks"]);
  });
  it("reads the profile: destinations and travelers", () => {
    const p = parseWholePlan(answer)[0];
    expect(p.kind === "profile" && p.profile.destinations[0].cities.map((c) => c.name)).toEqual(["טוקיו", "קיוטו"]);
    expect(p.kind === "profile" && p.profile.travelers[1]).toMatchObject({ name: "נועה", age: 8 });
  });
  it("drops invalid items but keeps the block", () => {
    const places = parseWholePlan(answer).find((p) => p.kind === "places");
    expect(places && "items" in places && places.items.length).toBe(1);
    const bookings = parseWholePlan(answer).find((p) => p.kind === "bookings");
    expect(bookings && "items" in bookings && bookings.items.length).toBe(1);
  });
  it("maps booking kinds and ages", () => {
    expect(bookingKindKey("טיסה")).toBe("flight");
    expect(bookingKindKey("Ryokan")).toBe("hotel");
    expect(ageGroupOf(8)).toBe("child");
    expect(ageGroupOf(undefined)).toBe("adult");
  });
  it("returns nothing for a normal single answer without a kind", () => {
    expect(parseWholePlan("no blocks here")).toEqual([]);
  });
});

describe("what a long plan keeps", () => {
  const answer = [
    "```tripdata",
    JSON.stringify({ v: 1, kind: "profile", overview: "מתחילים ליד השדה ומסיימים בעיר בלי רכב.", destinations: [] }),
    "```",
    "```tripdata",
    JSON.stringify({
      v: 1,
      kind: "itinerary",
      items: [
        { day: "2027-04-02", place: "Castle", day_summary: "יום של טירות.", plan_b: "בגשם: המוזיאון.", optional: "true" },
        { day: "2027-04-02", place: "Market" },
      ],
    }),
    "```",
  ].join("\n");
  const parts = parseWholePlan(answer);
  it("keeps the trip overview even with no destinations", () => {
    expect(parts[0]).toMatchObject({ kind: "profile", profile: { overview: "מתחילים ליד השדה ומסיימים בעיר בלי רכב." } });
  });
  it("keeps the day's intent, plan B and optional stops", () => {
    const it0 = (parts[1] as { items: Record<string, unknown>[] }).items[0];
    expect(it0).toMatchObject({ day_summary: "יום של טירות.", plan_b: "בגשם: המוזיאון.", optional: true });
  });
});
