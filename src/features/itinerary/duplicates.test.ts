import { describe, expect, it } from "vitest";
import type { TripSnapshot } from "../trip-data/types";
import { doubledPlan } from "./duplicates";

const stop = (id: string, day: string, text: string, imp: string | null, at: string) => ({ id, day_id: day, free_text: text, place_id: null, ai_import_id: imp, created_at: at, deleted_at: null, position: id });

describe("doubled plan", () => {
  it("finds the old stops in days the newest import added the same stops to", () => {
    const snap = {
      places: [],
      stops: [
        stop("a1", "d1", "Meiji Jingu", "old", "2026-11-01"),
        stop("a2", "d1", "Kiddy Land", "old", "2026-11-01"),
        stop("b1", "d1", "Meiji Jingu", "new", "2026-11-18"),
        stop("b2", "d1", "Ichiran", "new", "2026-11-18"),
        stop("a3", "d2", "Senso-ji", "old", "2026-11-01"),
        stop("b3", "d2", "Tsukiji", "new", "2026-11-18"), // nothing shared: maybe meant to add, leave it
        stop("m1", "d1", "קפה ליד המלון", null, "2026-11-10"), // typed by hand: stays
      ],
    } as unknown as TripSnapshot;
    const r = doubledPlan(snap)!;
    expect(r.days).toBe(1);
    expect(r.remove.map((s) => s.id).sort()).toEqual(["a1", "a2"]);
    expect(r.keep).toBe(2);
  });
  it("says nothing when there's nothing doubled", () => {
    expect(doubledPlan({ places: [], stops: [stop("a", "d1", "x", "i1", "2026-11-01")] } as unknown as TripSnapshot)).toBeNull();
  });
});
