import { describe, expect, it } from "vitest";
import type { TripSnapshot } from "../trip-data/types";
import { buildGuide } from "./guide";

const snap = {
  trip: { id: "t", name: "יפן", start_date: "2027-04-01", end_date: "2027-04-03", profile: {} },
  days: [
    { id: "d1", date: "2027-04-01", city: "טוקיו", title: "יום ראשון", lodging_place_id: null, flexible: false },
    { id: "d2", date: "2027-04-02", city: "טוקיו", title: null, lodging_place_id: null, flexible: false },
    { id: "d3", date: "2027-04-03", city: "תל אביב / בדרך", title: null, lodging_place_id: null, flexible: false },
  ],
  stops: [
    { id: "s1", day_id: "d1", place_id: "h", free_text: null, start_time: "15:00:00", time_of_day: null, notes: null, transport_note: null, position: "a0", deleted_at: null },
    { id: "s2", day_id: "d2", place_id: "p", free_text: null, start_time: "09:00:00", time_of_day: null, notes: "להגיע מוקדם", transport_note: "JR", position: "a0", deleted_at: null },
  ],
  places: [
    { id: "h", name: "Hotel Gracery", category: "lodging", city: "טוקיו", status: "want", priority: "maybe", lat: null, lng: null, maps_url: null, deleted_at: null },
    { id: "p", name: "Meiji Jingu", category: "attraction", city: "טוקיו", status: "want", priority: "must", lat: 35.6, lng: 139.6, maps_url: null, deleted_at: null },
  ],
  bookings: [{ id: "b", kind: "flight", title: "LY91", confirmation_code: "K7XQ2P", deleted_at: null }],
  travelers: [{ id: "x", label: "אמא", deleted_at: null }],
  notes: [
    { kind: "tip", title: "Suica", body: "לטעון בתחנה", deleted_at: null },
    { kind: "emergency", title: "שגרירות", body: "03-0000", deleted_at: null },
  ],
} as unknown as TripSnapshot;

describe("trip guide", () => {
  const g = buildGuide(snap);
  it("lays out the days with times, notes and where we sleep", () => {
    expect(g.days[1].stops[0]).toMatchObject({ time: "09:00", name: "Meiji Jingu", note: "להגיע מוקדם", transport: "JR", must: true });
    expect(g.days[1].stay).toBe("Hotel Gracery");
    expect(g.days[2].stay).toBeNull(); // the flight home
  });
  it("lists places by city with the hotels apart, and leaves out home", () => {
    expect(g.route.map((r) => r.city)).toEqual(["טוקיו"]);
    expect(g.cities[0]).toMatchObject({ city: "טוקיו", stays: ["Hotel Gracery"] });
    expect(g.cities[0].places.map((p) => p.name)).toEqual(["Meiji Jingu"]);
  });
  it("has nothing personal in it", () => {
    const text = JSON.stringify(g);
    expect(text).not.toContain("K7XQ2P");
    expect(text).not.toContain("אמא");
    expect(text).not.toContain("שגרירות");
  });
});

describe("hotels go under the city we slept in", () => {
  const s = {
    ...snap,
    trip: { ...snap.trip, end_date: "2027-04-03" },
    days: [
      { id: "d1", date: "2027-04-01", city: "טוקיו", title: null, lodging_place_id: null, flexible: false },
      { id: "d2", date: "2027-04-02", city: "טוקיו", title: null, lodging_place_id: null, flexible: false },
      { id: "d3", date: "2027-04-03", city: "קנאזאווה", title: null, lodging_place_id: null, flexible: false },
      { id: "d4", date: "2027-04-04", city: "קנאזאווה", title: null, lodging_place_id: null, flexible: false },
    ],
    stops: [
      { id: "s1", day_id: "d1", place_id: "h", free_text: null, start_time: null, time_of_day: null, notes: null, transport_note: null, position: "a0", deleted_at: null },
      { id: "s2", day_id: "d2", place_id: "k", free_text: null, start_time: null, time_of_day: null, notes: null, transport_note: null, position: "a1", deleted_at: null },
      { id: "s3", day_id: "d2", place_id: null, free_text: "Hokuriku Shinkansen", start_time: null, time_of_day: null, notes: null, transport_note: null, position: "a0", deleted_at: null },
    ],
    places: [
      { id: "h", name: "Hotel Gracery", category: "lodging", city: "טוקיו", status: "want", priority: "maybe", maps_url: null, deleted_at: null },
      { id: "k", name: "Hotel Kaga", category: "lodging", city: "קנאזאווה", status: "want", priority: "maybe", maps_url: null, deleted_at: null },
      { id: "t", name: "Hokuriku Shinkansen Kagayaki", category: "other", city: "טוקיו / קנאזאווה", status: "want", priority: "maybe", maps_url: null, deleted_at: null },
    ],
  } as unknown as TripSnapshot;
  const g = buildGuide(s);
  it("the hotel we reach on a travel day belongs to the next city", () => {
    expect(g.cities.find((c) => c.city === "טוקיו")?.stays).toEqual(["Hotel Gracery"]);
    expect(g.cities.find((c) => c.city === "קנאזאווה")?.stays).toEqual(["Hotel Kaga"]);
  });
  it("trains are not places to recommend", () => {
    expect(JSON.stringify(g.cities)).not.toContain("Kagayaki");
  });
});
