// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseKml } from "./kml";

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Japan</name>
<Folder><name>Food</name>
  <Placemark><name>Nishiki Market</name><description><![CDATA[Great snacks<br>Open 9-18]]></description>
    <Point><coordinates>
      135.7649,35.0050,0
    </coordinates></Point></Placemark>
  <Placemark><name>Route</name><LineString><coordinates>135.7,35.0 135.8,35.1</coordinates></LineString></Placemark>
</Folder>
<Placemark><name>Fushimi Inari</name><Point><coordinates>135.7727,34.9671</coordinates></Point></Placemark>
<Placemark><name></name><Point><coordinates>1,1</coordinates></Point></Placemark>
</Document></kml>`;

describe("parseKml", () => {
  it("takes named points with layer and plain description", () => {
    const pts = parseKml(KML);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ name: "Nishiki Market", description: "Great snacks\nOpen 9-18", lat: 35.005, lng: 135.7649, layer: "Food" });
    expect(pts[1]).toMatchObject({ name: "Fushimi Inari", lat: 34.9671, lng: 135.7727, layer: null });
  });

  it("rejects non-KML", () => {
    expect(() => parseKml("<html><body>")).toThrow();
  });

});
