import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { kmzToKml } from "./kml";

describe("kmzToKml", () => {
  it("reads doc.kml out of a KMZ", () => {
    const kmz = zipSync({ "doc.kml": strToU8("<kml><Placemark/></kml>"), "images/a.png": new Uint8Array([1]) });
    expect(kmzToKml(kmz)).toContain("<Placemark/>");
  });

  it("falls back to any .kml file", () => {
    const kmz = zipSync({ "Japan.kml": strToU8("<kml>x</kml>") });
    expect(kmzToKml(kmz)).toBe("<kml>x</kml>");
  });

  it("fails without a kml", () => {
    expect(() => kmzToKml(zipSync({ "a.txt": strToU8("x") }))).toThrow();
  });
});
