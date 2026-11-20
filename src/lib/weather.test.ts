import { describe, expect, it } from "vitest";
import { splitDates, weatherKind } from "./weather";

describe("weather", () => {
  it("maps WMO codes to a few kinds", () => {
    expect([0, 2, 3, 45, 53, 63, 81, 73, 95].map(weatherKind)).toEqual(["clear", "partly", "cloudy", "fog", "drizzle", "rain", "rain", "snow", "storm"]);
  });
  it("uses the forecast up to 15 days ahead, last year's weather beyond", () => {
    const r = splitDates(["2026-11-17", "2026-11-18", "2026-12-03", "2026-12-04"], "2026-11-18");
    expect(r.forecast).toEqual(["2026-11-18", "2026-12-03"]);
    expect(r.lastYear).toEqual(["2026-11-17", "2026-12-04"]);
  });
});
