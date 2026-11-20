import { describe, expect, it } from "vitest";
import { parseTripProfile } from "@/lib/trip-profile";
import type { TripSnapshot } from "../trip-data/types";
import { fixProfileDates, mergePlanCities, missingFromProfile, planCities } from "./profile-sync";

const snap = (cities: (string | null)[]) =>
  ({
    days: cities.map((city, i) => ({ id: `d${i}`, date: `2027-05-${String(i + 1).padStart(2, "0")}`, city, lodging_place_id: null })),
    stops: [],
    places: [],
  }) as unknown as TripSnapshot;

describe("profile sync from the plan", () => {
  it("collects the plan's cities in order with their first and last day", () => {
    expect(planCities(snap(["מילאנו", "מילאנו", null, "ונציה", "פירנצה", "פירנצה"]))).toEqual([
      { name: "מילאנו", from: "2027-05-01", to: "2027-05-02" },
      { name: "ונציה", from: "2027-05-04", to: "2027-05-04" },
      { name: "פירנצה", from: "2027-05-05", to: "2027-05-06" },
    ]);
  });
  it("a city you come back to is two stays", () => {
    expect(planCities(snap(["טוקיו", "טוקיו", "קיוטו", "טוקיו"]))).toEqual([
      { name: "טוקיו", from: "2027-05-01", to: "2027-05-02" },
      { name: "קיוטו", from: "2027-05-03", to: "2027-05-03" },
      { name: "טוקיו", from: "2027-05-04", to: "2027-05-04" },
    ]);
  });
  it("fixes a range that swallowed the stays in between, and adds the second stay", () => {
    const runs = planCities(snap(["טוקיו", "טוקיו", "קיוטו", "טוקיו"]));
    const fixed = fixProfileDates([{ country: "יפן", cities: [{ name: "טוקיו", from: "2027-05-01", to: "2027-05-04", area: "" }, { name: "קיוטו", from: "2027-05-03", to: "2027-05-03", area: "" }] }], runs);
    expect(fixed[0].cities[0]).toMatchObject({ from: "2027-05-01", to: "2027-05-02" });
    const missing = missingFromProfile({ ...parseTripProfile({}), destinations: fixed }, runs);
    expect(missing).toEqual([{ name: "טוקיו", from: "2027-05-04", to: "2027-05-04" }]);
  });
  it("leaves out travel days and home", () => {
    expect(planCities(snap(["תל אביב / בדרך", "טוקיו", "תל אביב / לוד"])).map((c) => c.name)).toEqual(["טוקיו"]);
    expect(mergePlanCities([], [{ name: "חיפה", from: "2027-05-01", to: "2027-05-01" }], () => "ישראל")).toEqual([]);
  });
  it("finds only cities the profile doesn't have", () => {
    const profile = parseTripProfile({ destinations: [{ country: "איטליה", cities: [{ name: "Milano" }, { name: "מילאנו" }] }] });
    expect(missingFromProfile(profile, planCities(snap(["מילאנו", "ונציה"]))).map((c) => c.name)).toEqual(["ונציה"]);
  });
  it("adds to the only country, or asks where each belongs", () => {
    const runs = planCities(snap(["מילאנו", "ונציה"]));
    expect(mergePlanCities([{ country: "איטליה", cities: [] }], runs, () => null)[0].cities.map((c) => c.name)).toEqual(["מילאנו", "ונציה"]);
    const none = mergePlanCities([], runs, (c) => (c === "מילאנו" ? "איטליה" : null));
    expect(none).toEqual([{ country: "איטליה", cities: [{ name: "מילאנו", from: "2027-05-01", to: "2027-05-01", area: "" }] }]);
    const two = mergePlanCities(
      [
        { country: "שווייץ", cities: [] },
        { country: "Italy", cities: [] },
      ],
      runs,
      () => "italy",
    );
    expect(two[1].cities).toHaveLength(2);
  });
});
