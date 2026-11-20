import { describe, expect, it } from "vitest";
import { daysBetween, formatShortDate, todayIn, tripDay, tripPhase } from "./dates";

describe("daysBetween", () => {
  it("counts calendar days across a DST change", () => {
    expect(daysBetween("2027-03-25", "2027-03-30")).toBe(5); // Israel DST starts in between
    expect(daysBetween("2027-01-10", "2027-01-01")).toBe(-9);
  });
});

describe("tripPhase", () => {
  const trip = { start_date: "2027-04-10", end_date: "2027-04-20" };

  it("is before, during and after by date, inclusive of both ends", () => {
    expect(tripPhase(trip, "2027-04-09")).toBe("before");
    expect(tripPhase(trip, "2027-04-10")).toBe("during");
    expect(tripPhase(trip, "2027-04-20")).toBe("during");
    expect(tripPhase(trip, "2027-04-21")).toBe("after");
  });

  it("treats a trip without dates as being planned", () => {
    expect(tripPhase({ start_date: null, end_date: null }, "2027-04-21")).toBe("before");
  });

  it("lets a manual override win", () => {
    expect(tripPhase({ ...trip, phase_override: "during" }, "2027-01-01")).toBe("during");
  });

  it("handles a one-day trip with no end date", () => {
    expect(tripPhase({ start_date: "2027-04-10", end_date: null }, "2027-04-10")).toBe("during");
    expect(tripPhase({ start_date: "2027-04-10", end_date: null }, "2027-04-11")).toBe("after");
  });
});

describe("tripDay", () => {
  it("numbers days from 1", () => {
    expect(tripDay({ start_date: "2027-04-10", end_date: "2027-04-20" }, "2027-04-12")).toEqual({ day: 3, total: 11 });
  });
});

describe("todayIn", () => {
  it("uses the given time zone, not the device's", () => {
    const lateNightUtc = new Date("2027-04-09T22:30:00Z"); // already the 10th in Tokyo and Israel
    expect(todayIn("Asia/Tokyo", lateNightUtc)).toBe("2027-04-10");
    expect(todayIn("Asia/Jerusalem", lateNightUtc)).toBe("2027-04-10");
    expect(todayIn("America/New_York", lateNightUtc)).toBe("2027-04-09");
  });
});

describe("formatShortDate", () => {
  it("drops leading zeros and the century", () => {
    expect(formatShortDate("2027-04-01")).toBe("1.4.27");
    expect(formatShortDate("2026-11-17")).toBe("17.11.26");
  });
});
