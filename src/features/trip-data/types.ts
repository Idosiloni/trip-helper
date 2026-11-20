import type { Tables } from "@/lib/supabase/database.types";

export type Trip = Tables<"trips">;
export type Member = Tables<"trip_members"> & { profile: { display_name: string; avatar_color: string } | null };
export type Traveler = Tables<"travelers">;
export type TaskGroup = Tables<"task_groups">;
export type Task = Tables<"tasks">;
export type Bag = Tables<"bags">;
export type PackingItem = Tables<"packing_items">;
export type Activity = Tables<"activity">;
export type Place = Tables<"places">;
export type TripDay = Tables<"trip_days">;
export type Stop = Tables<"stops">;
export type Booking = Tables<"bookings">;
export type Purchase = Tables<"purchases">;
export type TripNote = Tables<"trip_notes">;
export type JournalEntry = Tables<"journal_entries">;
export type Role = Tables<"trip_members">["role"];

export type TripSnapshot = {
  status: "loading" | "ready" | "error" | "not_found";
  /** false while the realtime channel is down (shown as a small "offline" badge). */
  live: boolean;
  /** When the data last came from the server (null = only the copy on this device). */
  syncedAt: string | null;
  /** Changes made offline that are still waiting to be sent. */
  pending: number;
  trip: Trip | null;
  me: { userId: string; role: Role | null; travelerId: string | null };
  members: Member[];
  travelers: Traveler[];
  taskGroups: TaskGroup[];
  tasks: Task[];
  bags: Bag[];
  packing: PackingItem[];
  places: Place[];
  days: TripDay[];
  stops: Stop[];
  bookings: Booking[];
  purchases: Purchase[];
  notes: TripNote[];
  journal: JournalEntry[];
  activity: Activity[];
};

/** Tables kept in the store, keyed by their snapshot field. */
export const TABLES = {
  travelers: "travelers",
  taskGroups: "task_groups",
  tasks: "tasks",
  bags: "bags",
  packing: "packing_items",
  places: "places",
  days: "trip_days",
  stops: "stops",
  bookings: "bookings",
  purchases: "purchases",
  notes: "trip_notes",
  journal: "journal_entries",
} as const;

export type ListKey = keyof typeof TABLES;
