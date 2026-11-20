import { describe, expect, it } from "vitest";
import { distanceKm, geocodeKey, googleMapsDirectionsUrl, googleMapsSearchUrl, isShortMapsLink, parseGoogleMapsLink } from "./geo";

describe("Google Maps links", () => {
  it("searches by point when we have one, by text otherwise", () => {
    expect(googleMapsSearchUrl({ name: "x", lat: 34.97, lng: 135.77 })).toBe("https://www.google.com/maps/search/?api=1&query=34.97%2C135.77");
    expect(googleMapsSearchUrl({ name: "Fushimi Inari", city: "Kyoto" })).toBe("https://www.google.com/maps/search/?api=1&query=Fushimi%20Inari%2C%20Kyoto");
  });

  it("builds a directions link", () => {
    expect(googleMapsDirectionsUrl({ name: "x", lat: 1, lng: 2 }, "walking")).toBe("https://www.google.com/maps/dir/?api=1&destination=1%2C2&travelmode=walking");
  });

  it.each([
    ["https://www.google.com/maps/place/Fushimi+Inari/@34.9671402,135.7726717,17z/data=!3m1", { lat: 34.9671402, lng: 135.7726717 }],
    ["https://www.google.com/maps/place/X/data=!4m6!3m5!1s0x0!8m2!3d34.9671402!4d135.7726717", { lat: 34.9671402, lng: 135.7726717 }],
    ["https://maps.google.com/?q=35.0116,135.7681", { lat: 35.0116, lng: 135.7681 }],
  ])("reads coordinates from %s", (url, expected) => {
    expect(parseGoogleMapsLink(url)).toEqual(expected);
  });

  it("can't expand short links", () => {
    expect(parseGoogleMapsLink("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(isShortMapsLink("https://maps.app.goo.gl/abc123")).toBe(true);
  });
});

describe("geo utils", () => {
  it("normalizes cache keys", () => {
    expect(geocodeKey("Fushimi  Inari!", "Kyoto", null)).toBe(geocodeKey("fushimi inari", "KYOTO", ""));
  });

  it("measures distance", () => {
    const tokyoKyoto = distanceKm({ lat: 35.681, lng: 139.767 }, { lat: 34.985, lng: 135.758 });
    expect(tokyoKyoto).toBeGreaterThan(360);
    expect(tokyoKyoto).toBeLessThan(380);
  });
});
