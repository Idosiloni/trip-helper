import { describe, expect, it } from "vitest";
import type { TripSnapshot } from "../trip-data/types";
import { itineraryPayload, lodgingConflicts, planItinerary, type PlannedDay } from "./plan-import";

const snap = {
  days: [
    { id: "d1", date: "2027-04-03", city: "קיוטו" },
    { id: "d2", date: "2027-04-04", city: "קיוטו" },
  ],
  places: [{ id: "p1", name: "Fushimi Inari Taisha", city: "קיוטו", deleted_at: null, position: "a0" }],
  stops: [{ id: "s1", day_id: "d2", place_id: null, free_text: "ארוחת בוקר", deleted_at: null, position: "a0" }],
} as unknown as TripSnapshot;

const items = [
  { day: "2027-04-03", place: "Nishiki Market", city: "קיוטו", category: "אוכל", time: "evening" as const },
  { day: "2027-04-04", place: "fushimi inari taisha", time: "morning" as const, minutes: 150 },
  { day: "2027-04-04", place: "ארוחת צהריים", category: "אוכל" },
  { day: 2, place: "Nishiki Market", city: "קיוטו" },
  { day: "2030-01-01", place: "Somewhere", city: "x" },
];

describe("planItinerary", () => {
  const plan = planItinerary(snap, items);

  it("groups by day (dates or 1-based numbers), unknown dates go to 'not scheduled'", () => {
    expect(plan.days.map((d) => [d.dayId, d.stops.length])).toEqual([
      ["d1", 1],
      ["d2", 3],
      [null, 1],
    ]);
  });

  it("matches existing places by name, creates each new place once, keeps plain text as text", () => {
    const d2 = plan.days[1].stops;
    expect(d2[0].placeId).toBe("p1");
    expect(d2[1]).toMatchObject({ placeId: null, newPlaceKey: null }); // "ארוחת צהריים" stays text
    expect(plan.newPlaces.map((p) => p.name)).toEqual(["Nishiki Market", "Somewhere"]);
  });

  it("shows what the day has now", () => {
    expect(plan.days[1].current).toEqual(["ארוחת בוקר"]);
  });

  it("builds a payload: replace vs append, only for chosen days, new places linked by id", () => {
    const { payload, count } = itineraryPayload(snap, plan.days, plan.newPlaces, { include: new Set(["d1", "d2"]), replace: new Set(["d2"]) });
    expect(payload.replace_day_ids).toEqual(["d2"]);
    expect(payload.places.map((p) => p.name)).toEqual(["Nishiki Market"]); // "Somewhere" day not chosen
    expect(count).toBe(1 + 4);
    const nishiki = payload.places[0].id;
    expect(payload.stops.filter((s) => s.place_id === nishiki)).toHaveLength(2);
    expect(payload.stops.find((s) => s.free_text === "ארוחת צהריים")).toBeTruthy();
    // replaced day starts fresh; appended day goes after its existing stop
    const d1 = payload.stops.filter((s) => s.day_id === "d1");
    expect(String(d1[0].position) > "").toBe(true);
  });

  it("orders a day's stops by start time / part of day, keeping the chat's order otherwise", () => {
    const p = planItinerary(snap, [
      { day: "2027-04-03", place: "Dinner", time: "evening" },
      { day: "2027-04-03", place: "Walk after dinner" },
      { day: "2027-04-03", place: "Temple", time: "morning" },
      { day: "2027-04-03", place: "Lunch", start: "12:30" },
    ]);
    expect(p.days[0].stops.map((s) => s.label)).toEqual(["Temple", "Lunch", "Dinner", "Walk after dinner"]);
  });
});

describe("activities aren't places", () => {
  it("keeps journeys and meals 'nearby' as text even when the chat gave them a city", () => {
    const p = planItinerary(snap, [
      { day: "2027-04-03", place: "Lunch near Campo Santa Maria Formosa", city: "ונציה" },
      { day: "2027-04-03", place: "Frecciarossa Milano → Venezia", city: "ונציה" },
      { day: "2027-04-03", place: "Back to Milano", city: "מילאנו" },
      { day: "2027-04-03", place: "ארוחת ערב באזור Gion", city: "קיוטו" },
      { day: "2027-04-03", place: "Teamlab Borderless", city: "טוקיו" },
    ]);
    expect(p.newPlaces.map((x) => x.name)).toEqual(["Teamlab Borderless"]);
  });
});

describe("lodgingConflicts", () => {
  const snap = {
    places: [],
    bookings: [{ id: "b1", kind: "hotel", title: "Hotel Kaga Kanazawa", starts_at: "2027-04-01T06:00:00Z", starts_tz: "Asia/Tokyo", ends_at: "2027-04-03T02:00:00Z", ends_tz: "Asia/Tokyo", place_id: null, deleted_at: null }],
  } as unknown as TripSnapshot;
  const day = (date: string, place: string, category?: string) =>
    ({ dayId: date, date, label: date, current: [], stops: [{ key: 0, label: place, placeId: null, newPlaceKey: null, item: { day: date, place, category } }] }) as unknown as PlannedDay;
  it("warns when the plan's hotel isn't the booked one", () => {
    expect(lodgingConflicts(snap, [day("2027-04-01", "Hotel Hana Kanazawa", "לינה")])).toEqual([{ date: "2027-04-01", pasted: "Hotel Hana Kanazawa", saved: "Hotel Kaga Kanazawa" }]);
  });
  it("stays quiet for the same hotel, other stops, and nights without a booking", () => {
    expect(lodgingConflicts(snap, [day("2027-04-02", "Hotel Kaga Kanazawa (Korinbo)", "לינה")])).toEqual([]);
    expect(lodgingConflicts(snap, [day("2027-04-01", "Kenroku-en", "טבע")])).toEqual([]);
    expect(lodgingConflicts(snap, [day("2027-04-05", "Hotel Kamo Kyoto", "לינה")])).toEqual([]);
  });
});
