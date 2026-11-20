import { describe, expect, it } from "vitest";
import { findDuplicates, findSimilar } from "./dedupe";

describe("findDuplicates", () => {
  it("ignores case, punctuation, spacing and niqqud", () => {
    const r = findDuplicates(["Rain  Jacket!", "מְעִיל גשם", "סוודר", "סוודר."], ["rain jacket", "מעיל-גשם"]);
    expect(r).toEqual([
      { duplicateOf: "rain jacket", repeatInBatch: false },
      { duplicateOf: "מעיל-גשם", repeatInBatch: false },
      { duplicateOf: null, repeatInBatch: false },
      { duplicateOf: null, repeatInBatch: true },
    ]);
  });
});

describe("findSimilar", () => {
  it("flags a task that repeats one already on the list", () => {
    const existing = [
      { title: "לשמור מקומות לשינקנסן (1.12, 4.12, 8.12) ו-Romancecar (9.12)", due: "2027-03-25" },
      { title: "לשלוח מייל למלון על משלוח מזוודות", due: "2027-03-24" },
    ];
    const out = findSimilar(
      [
        { title: "לשמור מקומות בשינקנסן ל-1.12 ול-4.12", due: null },
        { title: "לשלוח מייל למלון בקיוטו על המזוודות", due: "2027-03-24" },
        { title: "לקנות Hakone Freepass", due: "2027-03-25" },
        { title: "לשלוח מייל למלון על משלוח מזוודות", due: null },
      ],
      existing,
    );
    expect(out).toEqual([existing[0].title, existing[1].title, null, null]);
  });
});
