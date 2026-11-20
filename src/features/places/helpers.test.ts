import { describe, expect, it } from "vitest";
import type { Place } from "../trip-data/types";
import { isTransportPlace, primaryCity } from "./helpers";

const p = (name: string, category: Place["category"], city: string | null = null) => ({ name, category, city }) as Pick<Place, "name" | "category" | "city">;

describe("places from the Japan plan", () => {
  it("a travel day's city is the first one", () => {
    expect(primaryCity("טוקיו / קנאזאווה")).toBe("טוקיו");
    expect(primaryCity("קיוטו")).toBe("קיוטו");
    expect(primaryCity(" / ")).toBeNull();
    expect(primaryCity(null)).toBeNull();
  });
  it("flights, trains and the landing are transport; restaurants and hotels never", () => {
    expect(isTransportPlace(p("טיסה ליפן (Etihad)", "other", "תל אביב / בדרך"))).toBe(true);
    expect(isTransportPlace(p("Hokuriku Shinkansen Kagayaki", "other", "טוקיו / קנאזאווה"))).toBe(true);
    expect(isTransportPlace(p("רכבת Hida לנגויה ומשם שינקנסן לקיוטו", "other", "טקאיאמה / קיוטו"))).toBe(true);
    expect(isTransportPlace(p("Narita Airport & טיסת חזרה (Etihad)", "other", "טוקיו / נריטה"))).toBe(true);
    expect(isTransportPlace(p('נחיתה בישראל (נתב"ג)', "other", "תל אביב / לוד"))).toBe(true);
    expect(isTransportPlace(p("Hatsuhana Soba & Odakyu Romancecar", "food", "האקונה / טוקיו"))).toBe(false);
    expect(isTransportPlace(p("The Yama Hotel", "lodging", "האקונה"))).toBe(false);
    expect(isTransportPlace(p("Kenroku-en", "nature", "קנאזאווה"))).toBe(false);
  });
});
