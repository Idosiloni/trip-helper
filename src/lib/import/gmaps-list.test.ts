import { describe, expect, it } from "vitest";
import { firstUrl, guessCategory, isGmapsHost, listIdFrom, nearestCity, parseGetlist } from "./gmaps-list";

const entry = (name: string, lat: number, lng: number, note = "") => [
  null,
  [null, null, `${name}, Tokyo`, null, `1-2-3 Shibuya, Tokyo`, [null, null, lat, lng], ["111", "6287616717684047152"], "/m/x"],
  name,
  note,
];
const answer = `)]}'\n${JSON.stringify([[["id", 1], 4, null, ["Owner", "photo", "123"], "טוקיו", "", null, null, [entry("Ichiran", 35.66, 139.7, "ramen 24/7"), [null, [null, null, "bad"]], entry("Senso-ji", 35.71, 139.79)]]])}`;

describe("gmaps list", () => {
  it("parses places, skipping entries without coordinates", () => {
    const list = parseGetlist(answer);
    expect(list.title).toBe("טוקיו");
    expect(list.places).toHaveLength(2);
    expect(list.places[0]).toMatchObject({ name: "Ichiran", lat: 35.66, lng: 139.7, note: "ramen 24/7", address: "1-2-3 Shibuya, Tokyo", mapsUrl: "https://maps.google.com/?cid=6287616717684047152" });
    expect(list.places[1].note).toBeNull();
  });
  it("never throws on junk", () => {
    expect(parseGetlist("nope").places).toEqual([]);
    expect(parseGetlist("[]").places).toEqual([]);
    expect(parseGetlist('[[1,2,3]]').places).toEqual([]);
  });
  it("finds list ids and only accepts Google hosts", () => {
    expect(listIdFrom("https://www.google.com/maps/@/data=!3m1!4b1!4m3!11m2!2soq0an0dTHsvvN0Dsi8-gA5R1E49WAQ!3e3?entry=tts")).toBe("oq0an0dTHsvvN0Dsi8-gA5R1E49WAQ");
    expect(listIdFrom("https://www.google.com/maps/placelists/list/oq0an0dTHsvvN0Dsi8-gA5R1E49WAQ")).toBe("oq0an0dTHsvvN0Dsi8-gA5R1E49WAQ");
    expect(isGmapsHost("https://maps.app.goo.gl/RokrZ6ZxUJTnt5hu8")).toBe(true);
    expect(isGmapsHost("https://evil.com/maps.app.goo.gl")).toBe(false);
    expect(isGmapsHost("http://maps.app.goo.gl/x")).toBe(false);
    expect(firstUrl("תראו את הרשימה https://maps.app.goo.gl/abc שלי")).toBe("https://maps.app.goo.gl/abc");
  });
  it("files a place under the nearest city within reach", () => {
    const cities = [
      { name: "טוקיו", lat: 35.68, lng: 139.76 },
      { name: "קיוטו", lat: 35.01, lng: 135.77 },
    ];
    expect(nearestCity({ lat: 35.66, lng: 139.7 }, cities)).toBe("טוקיו");
    expect(nearestCity({ lat: 34.97, lng: 135.75 }, cities)).toBe("קיוטו");
    expect(nearestCity({ lat: 43.06, lng: 141.35 }, cities)).toBeNull();
  });
  it("guesses categories", () => {
    expect(guessCategory("Ichiran Ramen")).toBe("food");
    expect(guessCategory("Ueno Park")).toBe("nature");
    expect(guessCategory("Senso-ji")).toBe("attraction");
  });
});
