import type { TripSnapshot } from "../trip-data/types";

export const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);

export function travelerLabel(snap: TripSnapshot, id: string | null): string | null {
  if (!id) return null;
  return snap.travelers.find((t) => t.id === id)?.label ?? null;
}

/** Due date as YYYY-MM-DD in the device's zone (tasks before the trip are done at home). */
export function dueDay(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date (+ optional time) → ISO timestamp. All-day dues are stored at local noon to avoid date shifts. */
export function toDueAt(day: string, time: string | null): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time ? time.split(":").map(Number) : [12, 0];
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

/** Viewers may only toggle what's assigned to their own traveler (PLAN decision 5). */
export function canToggle(snap: TripSnapshot, assigneeTravelerId: string | null): boolean {
  const role = snap.me.role;
  if (role === "owner" || role === "editor") return true;
  return role === "viewer" && !!assigneeTravelerId && assigneeTravelerId === snap.me.travelerId;
}
