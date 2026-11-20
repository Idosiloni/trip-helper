import { describe, expect, it } from "vitest";
import type { Booking, Place, TripDay, TripSnapshot } from "../trip-data/types";
import { cancelDeadlines, flightJourneys, hasStay, hotelForNight, nightStay, stays } from "./helpers";

const hotel = (id: string, inUtc: string, outUtc: string | null, over: Partial<Booking> = {}): Booking =>
  ({ id, title: id, kind: "hotel", starts_at: inUtc, starts_tz: "Asia/Tokyo", ends_at: outUtc, ends_tz: "Asia/Tokyo", place_id: null, deleted_at: null, ...over }) as unknown as Booking;
const day = (date: string, lodging: string | null = null): TripDay => ({ id: date, date, lodging_place_id: lodging, city: null }) as unknown as TripDay;
const snapOf = (bookings: Booking[], places: Partial<Place>[] = []): TripSnapshot => ({ bookings, places, stops: [], days: [] }) as unknown as TripSnapshot;

describe("hotel stops carry over", () => {
  const days = [
    { id: "d1", date: "2027-04-01", city: "טוקיו", lodging_place_id: null },
    { id: "d2", date: "2027-04-02", city: "טוקיו", lodging_place_id: null },
    { id: "d3", date: "2027-04-03", city: "טוקיו", lodging_place_id: null },
    { id: "d4", date: "2027-04-04", city: "קנאזאווה", lodging_place_id: null },
  ] as unknown as TripDay[];
  const stops = [
    { id: "s1", day_id: "d1", place_id: "h", free_text: null, position: "a0", deleted_at: null },
    { id: "s2", day_id: "d3", place_id: null, free_text: "Hokuriku Shinkansen Kagayaki", position: "a0", deleted_at: null },
  ];
  const s = { days, stops, bookings: [], places: [{ id: "h", name: "Hotel Sakura", category: "lodging", deleted_at: null }] } as unknown as TripSnapshot;
  it("keeps the hotel for the following nights in the same city", () => {
    expect(nightStay(s, days[1])?.name).toBe("Hotel Sakura");
  });
  it("drops it on a travel day that ends in a new city", () => {
    expect(nightStay(s, days[2])).toBeNull();
  });
});

describe("hotel nights", () => {
  // Check-in 1.4 15:00 Tokyo (06:00Z), check-out 4.4 11:00 Tokyo (02:00Z): nights of 1, 2, 3 April.
  const h = hotel("Gracery", "2027-04-01T06:00:00Z", "2027-04-04T02:00:00Z");
  it("covers the nights from check-in up to (not including) check-out", () => {
    const snap = snapOf([h]);
    expect(hotelForNight(snap, "2027-03-31")).toBeNull();
    expect(hotelForNight(snap, "2027-04-01")?.id).toBe("Gracery");
    expect(hotelForNight(snap, "2027-04-03")?.id).toBe("Gracery");
    expect(hotelForNight(snap, "2027-04-04")).toBeNull();
  });
  it("ignores deleted bookings and non-hotels", () => {
    expect(hotelForNight(snapOf([{ ...h, deleted_at: "x" } as Booking]), "2027-04-02")).toBeNull();
    expect(hotelForNight(snapOf([{ ...h, kind: "flight" } as Booking]), "2027-04-02")).toBeNull();
  });
  it("prefers the lodging chosen on the day, else the hotel (with its place)", () => {
    const places = [{ id: "p1", name: "Ryokan", deleted_at: null }, { id: "p2", name: "Gracery Shinjuku", deleted_at: null }];
    expect(nightStay(snapOf([h], places), day("2027-04-02", "p1"))?.name).toBe("Ryokan");
    expect(nightStay(snapOf([h], places), day("2027-04-02"))?.name).toBe("Gracery");
    expect(nightStay(snapOf([{ ...h, place_id: "p2" } as Booking], places), day("2027-04-02"))?.place?.id).toBe("p2");
    expect(nightStay(snapOf([h], places), day("2027-04-05"))).toBeNull();
  });
});

describe("stays", () => {
  const days = ["טוקיו", "טוקיו", "קנאזאווה", "קיוטו", "קיוטו", "בדרך"].map((city, i) => ({ id: `d${i}`, date: `2027-04-0${i + 1}`, city, lodging_place_id: null })) as unknown as TripDay[];
  const stops = [
    { id: "t1", day_id: "d1", place_id: null, free_text: "Hokuriku Shinkansen", position: "a0", deleted_at: null },
    { id: "t2", day_id: "d4", place_id: null, free_text: "טיסת חזרה", position: "a0", deleted_at: null },
  ];
  const s = { days, stops, bookings: [], places: [] } as unknown as TripSnapshot;
  it("keeps the night where a hotel stop says we arrived, even on a travel day", () => {
    const withHotel = { ...s, stops: [...stops, { id: "h1", day_id: "d1", place_id: null, free_text: "The Yama Hotel", position: "a1", deleted_at: null }] } as unknown as TripSnapshot;
    expect(stays(withHotel)[0].nights.map((n) => n.date)).toEqual(["2027-04-01", "2027-04-02"]);
  });
  it("gives a travel day's night to the next city and skips the plane night", () => {
    expect(stays(s).map((x) => [x.city, x.nights.map((n) => n.date)])).toEqual([
      ["טוקיו", ["2027-04-01"]],
      ["קנאזאווה", ["2027-04-02", "2027-04-03"]],
      ["קיוטו", ["2027-04-04"]],
    ]);
  });
});

describe("what counts as where we sleep", () => {
  const days = [{ id: "d1", date: "2027-04-01", city: "האקונה", lodging_place_id: null }] as unknown as TripDay[];
  const places = [
    { id: "h", name: "The Yama Hotel", category: "lodging", deleted_at: null, notes: null },
    { id: "f", name: "Main Dining Room (The Yama Hotel)", category: "food", deleted_at: null, notes: null },
    { id: "n", name: "Hotel Hana Kanazawa", category: "lodging", deleted_at: null, notes: null },
  ];
  const snapWith = (stops: unknown[]) => ({ days, stops, bookings: [], places }) as unknown as TripSnapshot;
  const stop = (id: string, place: string, position: string, notes: string | null = null) => ({ id, day_id: "d1", place_id: place, free_text: null, position, notes, deleted_at: null });
  it("dinner at the hotel's restaurant is not the night's hotel", () => {
    const s = snapWith([stop("a", "h", "a0"), stop("b", "f", "a1")]);
    expect(nightStay(s, days[0])?.name).toBe("The Yama Hotel");
  });
  it("a hotel the chat only suggested is shown, but the night still counts as open", () => {
    const s = snapWith([stop("a", "n", "a0", "הצעה בלבד: אם כבר יש מלון אחר, להחליף.")]);
    expect(nightStay(s, days[0])?.suggested).toBe(true);
    expect(hasStay(s, days[0])).toBe(false);
  });
});

describe("flightJourneys", () => {
  const leg = (id: string, start: string, end: string) => ({ id, kind: "flight", starts_at: start, ends_at: end, deleted_at: null }) as unknown as Booking;
  it("joins connecting legs and splits the way home", () => {
    const out = flightJourneys([
      leg("ret2", "2027-04-11T22:45:00Z", "2027-04-12T03:00:00Z"),
      leg("out1", "2027-03-27T04:20:00Z", "2027-03-27T08:00:00Z"),
      leg("out2", "2027-03-27T17:05:00Z", "2027-03-28T02:40:00Z"),
      leg("ret1", "2027-04-11T08:20:00Z", "2027-04-11T19:30:00Z"),
    ]);
    expect(out.map((j) => j.map((b) => b.id))).toEqual([["out1", "out2"], ["ret1", "ret2"]]);
  });
});

describe("cancelDeadlines", () => {
  const b = (id: string, cancel_by: string | null) => ({ id, cancel_by, deleted_at: null }) as unknown as Booking;
  it("shows deadlines from three days before until the day itself", () => {
    const list = [b("a", "2027-03-26"), b("b", "2027-03-28"), b("c", "2027-03-22"), b("d", null), b("e", "2027-03-19")];
    expect(cancelDeadlines(list, "2027-03-23").map((x) => x.id)).toEqual(["a"]);
    expect(cancelDeadlines(list, "2027-03-22").map((x) => x.id)).toEqual(["c"]);
    expect(cancelDeadlines(list, "2027-03-25").map((x) => x.id)).toEqual(["a", "b"]);
  });
});
