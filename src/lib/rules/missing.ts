import { daysBetween } from "../dates";
import type { TripProfile } from "../trip-profile";
import type { PromptId } from "../prompts/registry";

// "What's missing" (SPEC 7.5): plain rules over the trip, no AI. Each result
// carries the prompt or screen that fixes it. Phase 1 covers what its tables
// allow; itinerary/lodging rules arrive with phase 2.

export type MissingAction =
  | { type: "prompt"; promptId: PromptId }
  | { type: "link"; to: "profile" | "travelers" | "tasks" | "packing" | "plan" | "places" | "confirm" | "lodging"; filter?: string };

export type Missing = {
  /** Overdue only: how many more are due today. */
  todayCount?: number;
  id: "profile" | "travelers" | "no_tasks" | "no_packing" | "overdue" | "unassigned" | "to_buy" | "empty_days" | "no_lodging" | "must_unscheduled" | "pins";
  /** urgent = act now; soon = worth doing; info = nice to know */
  level: "urgent" | "soon" | "info";
  count?: number;
  daysLeft?: number;
  action: MissingAction;
};

export type MissingInput = {
  today: string;
  startDate: string | null;
  profile: TripProfile;
  travelerCount: number;
  tasks: ReadonlyArray<{ done: boolean; due_at: string | null; assignee_traveler_id: string | null; phase: string; deleted_at: string | null }>;
  packing: ReadonlyArray<{ state: string; deleted_at: string | null }>;
  /** Phase 2 (optional so phase-1 callers keep working). */
  days?: ReadonlyArray<{ id: string; date: string; lodging_place_id: string | null; flexible: boolean }>;
  stops?: ReadonlyArray<{ day_id: string | null; place_id: string | null; deleted_at: string | null }>;
  places?: ReadonlyArray<{ id: string; priority: string; status: string; geocode_status: string; deleted_at: string | null }>;
  /** Nights (YYYY-MM-DD) already covered by a hotel booking. */
  hotelNights?: ReadonlySet<string>;
};

const PACKING_SOON_DAYS = 14;

export function findMissing(input: MissingInput): Missing[] {
  const out: Missing[] = [];
  const left = input.startDate ? daysBetween(input.today, input.startDate) : null;
  if (left !== null && left < 0) return out; // the trip has started; phase 3 has its own "today"

  if (input.profile.destinations.length === 0 || !input.startDate) {
    out.push({ id: "profile", level: "soon", action: { type: "link", to: "profile" } });
  }
  if (input.travelerCount === 0) {
    out.push({ id: "travelers", level: "soon", action: { type: "link", to: "travelers" } });
  }

  const tasks = input.tasks.filter((t) => !t.deleted_at);
  if (tasks.length === 0) {
    out.push({ id: "no_tasks", level: "soon", action: { type: "prompt", promptId: "p03-tasks" } });
  }

  const overdue = tasks.filter((t) => !t.done && t.due_at && t.due_at.slice(0, 10) < input.today).length;
  const dueToday = tasks.filter((t) => !t.done && t.due_at && t.due_at.slice(0, 10) === input.today).length;
  if (overdue > 0) out.push({ id: "overdue", level: "urgent", count: overdue, todayCount: dueToday, action: { type: "link", to: "tasks", filter: "overdue" } });

  // A task with no one on it belongs to everyone, which is the usual case, so it isn't "missing".

  const packing = input.packing.filter((p) => !p.deleted_at);
  if (packing.length === 0) {
    const urgent = left !== null && left <= PACKING_SOON_DAYS;
    out.push({ id: "no_packing", level: urgent ? "urgent" : "info", daysLeft: left ?? undefined, action: { type: "prompt", promptId: "p04-packing" } });
  }
  const toBuy = packing.filter((p) => p.state === "missing").length;
  if (toBuy > 0) out.push({ id: "to_buy", level: "soon", count: toBuy, action: { type: "link", to: "packing", filter: "missing" } });

  if (input.days && input.days.length) {
    const stops = (input.stops ?? []).filter((x) => !x.deleted_at);
    const empty = input.days.filter((d) => !d.flexible && !stops.some((x) => x.day_id === d.id)).length;
    if (empty > 0) {
      const level = left !== null && left <= 21 && empty === input.days.length ? "urgent" : "soon";
      out.push({ id: "empty_days", level, count: empty, action: { type: "prompt", promptId: "p01-itinerary" } });
    }
    // Every night but the last needs somewhere to sleep.
    const nights = [...input.days].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, -1);
    const noLodging = nights.filter((d) => !d.lodging_place_id && !input.hotelNights?.has(d.date)).length;
    if (noLodging > 0) out.push({ id: "no_lodging", level: "soon", count: noLodging, action: { type: "link", to: "lodging" } });

    const places = (input.places ?? []).filter((p) => !p.deleted_at);
    const scheduled = new Set(stops.filter((x) => x.day_id && x.place_id).map((x) => x.place_id));
    const mustLeft = places.filter((p) => p.priority === "must" && p.status === "want" && !scheduled.has(p.id)).length;
    if (mustLeft > 0) out.push({ id: "must_unscheduled", level: "soon", count: mustLeft, action: { type: "link", to: "places", filter: "must" } });
  }
  // Places without a confirmed pin aren't "missing": navigation works by name, and the places screen offers to find them all.

  const rank = { urgent: 0, soon: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
