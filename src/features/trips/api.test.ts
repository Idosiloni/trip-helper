import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ supabase: () => ({}) }));

import { bucketTrips, type TripSummary } from "./api";

const trip = (id: string, start: string | null, end: string | null, archived = false): TripSummary => ({
  id,
  name: id,
  theme_color: "#FF5A36",
  start_date: start,
  end_date: end,
  phase_override: null,
  archived_at: archived ? "2027-01-01T00:00:00Z" : null,
});

describe("bucketTrips", () => {
  it("groups trips into now, upcoming and archive", () => {
    const result = bucketTrips(
      [
        trip("past", "2026-01-01", "2026-01-10"),
        trip("current", "2026-11-10", "2026-11-20"),
        trip("future", "2027-04-01", "2027-04-10"),
        trip("undated", null, null),
        trip("archived-future", "2027-05-01", "2027-05-02", true),
      ],
      "2026-11-17",
    );
    expect(result.now.map((t) => t.id)).toEqual(["current"]);
    expect(result.upcoming.map((t) => t.id)).toEqual(["future", "undated"]);
    expect(result.archive.map((t) => t.id)).toEqual(["archived-future", "past"]);
  });
});
