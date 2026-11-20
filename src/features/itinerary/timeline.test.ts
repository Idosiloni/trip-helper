import { describe, expect, it } from "vitest";
import type { Booking, Stop } from "../trip-data/types";
import { buildTimeline, dayParts, nextStop } from "./timeline";

const stop = (id: string, over: Partial<Stop> = {}): Stop =>
  ({ id, start_time: null, time_of_day: null, duration_min: null, place_id: null, free_text: id, position: id, deleted_at: null, ...over }) as Stop;
const booking = (id: string, startsAt: string, tz = "Asia/Tokyo"): Booking =>
  ({ id, title: id, kind: "train", starts_at: startsAt, starts_tz: tz, ends_at: null, ends_tz: null, deleted_at: null }) as unknown as Booking;

const kinds = (items: ReturnType<typeof buildTimeline>) =>
  items.map((x) => (x.type === "section" ? `#${x.section}` : x.type === "stop" ? x.stop.id : `B:${x.booking.id}`));

describe("day timeline", () => {
  it("keeps a day with no times as a plain list", () => {
    expect(kinds(buildTimeline([stop("a"), stop("b")], []))).toEqual(["a", "b"]);
  });

  it("adds part-of-day headers where they change", () => {
    const items = buildTimeline([stop("a", { time_of_day: "morning" }), stop("b"), stop("c", { start_time: "14:00:00" }), stop("d", { time_of_day: "evening" })], []);
    expect(kinds(items)).toEqual(["#morning", "a", "b", "#noon", "c", "#evening", "d"]);
  });

  it("slots a booking in at its local time", () => {
    // 11:30 in Tokyo = 02:30Z
    const items = buildTimeline(
      [stop("a", { time_of_day: "morning" }), stop("c", { start_time: "13:00:00" })],
      [{ booking: booking("train", "2027-04-02T02:30:00Z"), edge: "start" }],
    );
    expect(kinds(items)).toEqual(["#morning", "a", "B:train", "#noon", "c"]);
  });

  it("puts bookings at the end of an untimed day", () => {
    expect(kinds(buildTimeline([stop("a")], [{ booking: booking("hotel", "2027-04-02T06:00:00Z"), edge: "start" }]))).toEqual(["a", "#noon", "B:hotel"]);
  });

  it("finds the next stop: skips visited and passed ones", () => {
    const items = buildTimeline(
      [stop("a", { start_time: "09:00:00", duration_min: 60 }), stop("b", { start_time: "11:00:00" }), stop("c", { start_time: "15:00:00" })],
      [],
    );
    expect(nextStop(items, 10 * 60 + 30, () => false)?.id).toBe("b");
    expect(nextStop(items, 9 * 60 + 30, (s) => s.id === "a")?.id).toBe("b");
    expect(nextStop(items, 20 * 60, () => false)).toBeNull();
    expect(nextStop(buildTimeline([stop("x")], []), 23 * 60, () => false)?.id).toBe("x");
  });
});

describe("dayParts", () => {
  it("splits by time and lets untimed stops follow the one before", () => {
    const p = dayParts([stop("a"), stop("b", { start_time: "08:45:00" }), stop("c"), stop("d", { start_time: "12:30:00" }), stop("e", { time_of_day: "evening" })]);
    expect(p.anytime.map((s) => s.id)).toEqual(["a"]);
    expect(p.morning.map((s) => s.id)).toEqual(["b", "c"]);
    expect(p.noon.map((s) => s.id)).toEqual(["d"]);
    expect(p.evening.map((s) => s.id)).toEqual(["e"]);
  });
});
