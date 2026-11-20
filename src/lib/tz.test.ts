import { describe, expect, it } from "vitest";
import { tzOffsetMinutes, utcToWallTime, wallTimeToUtc } from "./tz";

describe("time zones", () => {
  it("converts Tokyo wall time to UTC and back", () => {
    const iso = wallTimeToUtc("2027-04-01", "14:05", "Asia/Tokyo");
    expect(iso).toBe("2027-04-01T05:05:00.000Z");
    expect(utcToWallTime(iso, "Asia/Tokyo")).toEqual({ date: "2027-04-01", time: "14:05" });
    expect(utcToWallTime(iso, "Asia/Jerusalem")).toEqual({ date: "2027-04-01", time: "08:05" });
  });

  it("handles a date line crossing", () => {
    const iso = wallTimeToUtc("2027-04-01", "01:30", "Asia/Tokyo");
    expect(utcToWallTime(iso, "America/New_York").date).toBe("2027-03-31");
  });

  it("respects DST on both sides of the change (Israel, March 2027)", () => {
    expect(tzOffsetMinutes(new Date("2027-03-20T12:00:00Z"), "Asia/Jerusalem")).toBe(120);
    expect(tzOffsetMinutes(new Date("2027-04-10T12:00:00Z"), "Asia/Jerusalem")).toBe(180);
    expect(wallTimeToUtc("2027-04-10", "15:00", "Asia/Jerusalem")).toBe("2027-04-10T12:00:00.000Z");
    expect(wallTimeToUtc("2027-03-20", "15:00", "Asia/Jerusalem")).toBe("2027-03-20T13:00:00.000Z");
  });

  it("handles London summer time", () => {
    expect(wallTimeToUtc("2027-07-01", "09:00", "Europe/London")).toBe("2027-07-01T08:00:00.000Z");
  });
});
