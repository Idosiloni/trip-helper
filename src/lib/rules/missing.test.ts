import { describe, expect, it } from "vitest";
import { parseTripProfile } from "../trip-profile";
import { findMissing, type MissingInput } from "./missing";

const base = (over: Partial<MissingInput> = {}): MissingInput => ({
  today: "2027-03-20",
  startDate: "2027-04-01",
  profile: parseTripProfile({ destinations: [{ country: "יפן" }] }),
  travelerCount: 3,
  tasks: [{ done: false, due_at: "2027-03-25T00:00:00Z", assignee_traveler_id: "t1", phase: "before", deleted_at: null }],
  packing: [{ state: "need", deleted_at: null }],
  ...over,
});

const ids = (input: MissingInput) => findMissing(input).map((m) => m.id);

describe("findMissing", () => {
  it("is empty for a trip in good shape", () => {
    expect(ids(base())).toEqual([]);
  });

  it("flags a missing packing list as urgent within 14 days, info before that", () => {
    expect(findMissing(base({ packing: [] }))[0]).toMatchObject({ id: "no_packing", level: "urgent", daysLeft: 12 });
    expect(findMissing(base({ packing: [], today: "2026-11-17" }))[0]).toMatchObject({ id: "no_packing", level: "info" });
  });

  it("offers the matching prompt", () => {
    expect(findMissing(base({ tasks: [] })).find((m) => m.id === "no_tasks")?.action).toEqual({ type: "prompt", promptId: "p03-tasks" });
  });

  it("counts overdue tasks, ignoring done and deleted ones; unassigned is not missing", () => {
    const tasks = [
      { done: false, due_at: "2027-03-01T00:00:00Z", assignee_traveler_id: null, phase: "before", deleted_at: null },
      { done: true, due_at: "2027-03-01T00:00:00Z", assignee_traveler_id: null, phase: "before", deleted_at: null },
      { done: false, due_at: "2027-03-01T00:00:00Z", assignee_traveler_id: null, phase: "before", deleted_at: "2027-03-02T00:00:00Z" },
    ];
    const m = findMissing(base({ tasks }));
    expect(m.find((x) => x.id === "overdue")).toMatchObject({ count: 1, level: "urgent" });
    expect(m.find((x) => x.id === "unassigned")).toBeUndefined();
  });

  it("asks for profile and travelers when they're missing", () => {
    expect(ids(base({ profile: parseTripProfile({}), travelerCount: 0 }))).toEqual(expect.arrayContaining(["profile", "travelers"]));
  });

  it("counts items marked missing as to-buy", () => {
    expect(findMissing(base({ packing: [{ state: "missing", deleted_at: null }, { state: "missing", deleted_at: null }] }))).toContainEqual(
      expect.objectContaining({ id: "to_buy", count: 2 }),
    );
  });

  it("stays quiet once the trip has started", () => {
    expect(ids(base({ today: "2027-04-02", tasks: [], packing: [] }))).toEqual([]);
  });

  it("phase 2: empty days, nights without lodging, unscheduled must-sees, unconfirmed pins", () => {
    const days = [
      { id: "d1", date: "2027-04-01", lodging_place_id: "h1", flexible: false },
      { id: "d2", date: "2027-04-02", lodging_place_id: null, flexible: false },
      { id: "d3", date: "2027-04-03", lodging_place_id: null, flexible: true },
    ];
    const m = findMissing(
      base({
        days,
        stops: [{ day_id: "d1", place_id: "p1", deleted_at: null }],
        places: [
          { id: "p1", priority: "must", status: "want", geocode_status: "confirmed", deleted_at: null },
          { id: "p2", priority: "must", status: "want", geocode_status: "pending", deleted_at: null },
          { id: "p3", priority: "must", status: "visited", geocode_status: "confirmed", deleted_at: null },
        ],
      }),
    );
    expect(m.find((x) => x.id === "empty_days")).toMatchObject({ count: 1, action: { type: "prompt", promptId: "p01-itinerary" } }); // d3 is flexible
    expect(m.find((x) => x.id === "no_lodging")).toMatchObject({ count: 1 }); // d2 only; last night excluded
    expect(m.find((x) => x.id === "must_unscheduled")).toMatchObject({ count: 1 }); // p2
    expect(m.find((x) => x.id === "pins")).toBeUndefined();
  });
  it("counts a night covered by a hotel booking as lodging", () => {
    const days = [
      { id: "d1", date: "2027-04-01", lodging_place_id: null, flexible: false },
      { id: "d2", date: "2027-04-02", lodging_place_id: null, flexible: false },
      { id: "d3", date: "2027-04-03", lodging_place_id: null, flexible: false },
    ];
    expect(findMissing(base({ days })).find((x) => x.id === "no_lodging")).toMatchObject({ count: 2 });
    expect(findMissing(base({ days, hotelNights: new Set(["2027-04-01"]) })).find((x) => x.id === "no_lodging")).toMatchObject({ count: 1 });
    expect(findMissing(base({ days, hotelNights: new Set(["2027-04-01", "2027-04-02"]) })).find((x) => x.id === "no_lodging")).toBeUndefined();
  });
});
