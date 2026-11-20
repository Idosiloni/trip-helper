import { describe, expect, it } from "vitest";
import type { TripSnapshot } from "../trip-data/types";
import { dayText } from "./day-text";

const snap = {
  days: [
    { id: "d1", date: "2027-04-01", city: "טוקיו", title: "יום ראשון בעיר", lodging_place_id: "h", flexible: false },
    { id: "d2", date: "2027-04-02", city: null, title: null, lodging_place_id: null, flexible: true },
  ],
  stops: [
    { id: "s2", day_id: "d1", place_id: "p2", free_text: null, start_time: "12:30:00", time_of_day: null, duration_min: null, transport_note: "JR 10 דק׳", position: "a1", deleted_at: null },
    { id: "s1", day_id: "d1", place_id: "p1", free_text: null, start_time: "09:00:00", time_of_day: null, duration_min: null, transport_note: null, position: "a0", deleted_at: null },
    { id: "s3", day_id: "d1", place_id: null, free_text: "ארוחת ערב בגיון", start_time: null, time_of_day: "evening", duration_min: null, transport_note: null, position: "a2", deleted_at: null },
  ],
  places: [
    { id: "p1", name: "Meiji Jingu", lat: 35.67, lng: 139.69, maps_url: "https://maps.google.com/?cid=1", deleted_at: null },
    { id: "p2", name: "Takeshita", lat: null, lng: null, maps_url: null, city: "טוקיו", deleted_at: null },
    { id: "h", name: "Gracery", deleted_at: null },
  ],
  bookings: [],
} as unknown as TripSnapshot;

describe("dayText", () => {
  it("lists the day's stops in order, with times, how to get there, links and where we sleep", () => {
    const text = dayText(snap, snap.days[0]);
    expect(text.split("\n")[0]).toBe("*יום 1 · יום חמישי 1.4 · טוקיו*");
    expect(text).toContain("09:00 · Meiji Jingu\n   https://maps.google.com/?cid=1\n12:30 · Takeshita\n   JR 10 דק׳");
    expect(text).toContain("ערב · ארוחת ערב בגיון");
    expect(text).toContain("https://www.google.com/maps/search/");
    expect(text.trim().endsWith("ישנים ב: Gracery")).toBe(true);
  });
  it("leaves links out when asked and says when a day is free", () => {
    expect(dayText(snap, snap.days[0], { links: false })).not.toContain("https://");
    expect(dayText(snap, snap.days[1])).toContain("יום חופשי");
  });
});
