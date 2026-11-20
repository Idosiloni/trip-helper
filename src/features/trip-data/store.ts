"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { kv } from "@/lib/offline/kv";
import { applyPending, isNetworkError, isOffline, readOutbox, removeOp } from "@/lib/offline/outbox";
import { byPosition } from "@/lib/position";
import { TABLES, type Activity, type ListKey, type Member, type TripSnapshot } from "./types";

// One store per open trip (SPEC §11 "live for everyone"):
// - loads every row of the trip once (soft-deleted rows included, for the trash),
// - listens to postgres_changes for the trip on one channel,
// - applies local edits optimistically and sends ONLY the changed columns,
//   so two people editing different fields of the same row don't overwrite each other.
// On reconnect it reloads everything, so nothing missed while offline is lost.
// Offline (SPEC §10): the trip is kept on the device (IndexedDB) and shown from
// there first; edits made without a connection wait in an outbox (lib/offline)
// and are sent, in order, before the reload.

type Listener = () => void;
type Row = { id: string } & Record<string, unknown>;

const EMPTY: TripSnapshot = {
  status: "loading",
  // Assume connected until the channel reports an error, so the "offline"
  // badge doesn't flash during the first second of connecting.
  live: true,
  syncedAt: null,
  pending: 0,
  trip: null,
  me: { userId: "", role: null, travelerId: null },
  members: [],
  travelers: [],
  taskGroups: [],
  tasks: [],
  bags: [],
  packing: [],
  places: [],
  days: [],
  stops: [],
  bookings: [],
  purchases: [],
  notes: [],
  journal: [],
  activity: [],
};

const ACTIVITY_LIMIT = 100;

/** What is kept on the device: everything but the connection state. */
type Cached = Omit<TripSnapshot, "status" | "live" | "pending">;
const cacheKey = (userId: string, tripId: string) => `trip:${userId}:${tripId}`;

function sortList<T extends Row>(key: ListKey, rows: T[]): T[] {
  if (key === "days") return [...rows].sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
  if (key === "bookings") return [...rows].sort((a, b) => (String(a.starts_at ?? "9999") < String(b.starts_at ?? "9999") ? -1 : 1));
  return [...rows].sort(byPosition as unknown as (a: T, b: T) => number);
}

export class TripStore {
  private snap: TripSnapshot = EMPTY;
  private listeners = new Set<Listener>();
  private channel: RealtimeChannel | null = null;
  private wasSubscribed = false;
  private disposed = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private flushing: Promise<void> | null = null;
  private onOnline = () => void this.reconnect();

  constructor(readonly tripId: string) {}

  // --- React glue (useSyncExternalStore) ----------------------------------
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;

  private set(patch: Partial<TripSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    // Derive "me" from members/travelers whenever they change.
    const userId = this.snap.me.userId;
    const role = this.snap.members.find((m) => m.user_id === userId)?.role ?? null;
    const travelerId = this.snap.travelers.find((t) => t.linked_user_id === userId && !t.deleted_at)?.id ?? null;
    if (role !== this.snap.me.role || travelerId !== this.snap.me.travelerId) {
      this.snap = { ...this.snap, me: { userId, role, travelerId } };
    }
    this.listeners.forEach((l) => l());
    if (this.snap.status === "ready") this.scheduleSave();
  }

  // --- Device copy -------------------------------------------------------------
  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const rest: Cached & Partial<TripSnapshot> = { ...this.snap };
      delete rest.status;
      delete rest.live;
      delete rest.pending;
      if (rest.me.userId) void kv().set(cacheKey(rest.me.userId, this.tripId), rest);
    }, 800);
  }

  private async userId(): Promise<string> {
    // Local (no network): the session stored on this device.
    const { data } = await supabase().auth.getSession();
    return data.session?.user.id ?? "";
  }

  private async restoreFromDevice(userId: string) {
    if (!userId || this.snap.status === "ready") return;
    const cached = await kv().get<Partial<Cached>>(cacheKey(userId, this.tripId));
    if (!cached?.trip) return;
    // Merge over EMPTY: an older copy may lack lists added later.
    const ops = await readOutbox(userId, this.tripId);
    const merged = { ...EMPTY, ...cached, me: { ...EMPTY.me, ...cached.me, userId } } as TripSnapshot;
    for (const key of Object.keys(TABLES) as ListKey[]) {
      (merged[key] as unknown) = sortList(key, applyPending(merged[key] as unknown as Row[], ops, key, this.tripId));
    }
    this.snap = { ...merged, status: "loading", live: this.snap.live };
    this.set({ status: "ready", pending: ops.length });
  }

  // --- Outbox ------------------------------------------------------------------
  /** Sends changes made offline, in order. Stops at the first network failure. */
  flush(): Promise<void> {
    return (this.flushing ??= this.doFlush().finally(() => (this.flushing = null)));
  }

  private async doFlush() {
    if (isOffline()) return;
    const userId = this.snap.me.userId || (await this.userId());
    if (!userId) return;
    const ops = await readOutbox(userId, this.tripId);
    if (!ops.length) return this.set({ pending: 0 });
    const db = supabase() as unknown as import("@supabase/supabase-js").SupabaseClient;
    await db.auth.getSession(); // refreshes an expired token before sending
    let left = ops.length;
    for (const op of ops) {
      const res =
        op.kind === "insert"
          ? await db.from(op.table).insert({ ...op.values, id: op.rowId, trip_id: this.tripId })
          : await db.from(op.table).update(op.values).eq("id", op.rowId);
      if (res.error && isNetworkError(res.error, res.status)) break;
      // 23505: the insert already arrived earlier (the reply was lost). Anything
      // else is a refusal (e.g. lost permission): drop it; the reload shows the truth.
      if (res.error && res.error.code !== "23505") this.onRejected?.(op.table);
      await removeOp(userId, this.tripId, op.seq);
      left--;
    }
    this.set({ pending: left });
  }

  private onRejected: ((table: string) => void) | null = null;

  /** The UI registers how to tell the user that a queued change was refused. */
  setRejectedHandler(fn: ((table: string) => void) | null) {
    this.onRejected = fn;
  }

  async notePending() {
    const userId = this.snap.me.userId || (await this.userId());
    this.set({ pending: (await readOutbox(userId, this.tripId)).length });
  }

  private async reconnect() {
    await this.flush();
    if (!this.disposed) await this.load();
  }

  // --- Loading ---------------------------------------------------------------
  async start() {
    // May run again after dispose(): React re-runs effects when a hidden
    // (Activity) route is shown again, and in dev Strict Mode.
    this.disposed = false;
    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
    await this.restoreFromDevice(await this.userId());
    await this.flush().catch(() => {});
    await this.load();
    if (this.disposed || this.snap.status !== "ready" || this.channel) return;
    this.listen();
  }

  dispose() {
    this.disposed = true;
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);
    if (this.channel) void supabase().removeChannel(this.channel);
    this.channel = null;
    this.wasSubscribed = false;
    if (this.snap.live) this.set({ live: false });
  }

  async load() {
    const db = supabase();
    const id = this.tripId;
    try {
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError && isNetworkError(authError, (authError as { status?: number }).status)) throw authError;
      const [trip, members, travelers, groups, tasks, bags, packing, places, days, stops, bookings, purchases, notes, journal, activity] = await Promise.all([
        db.from("trips").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
        db.from("trip_members").select("*, profile:profiles(display_name, avatar_color)").eq("trip_id", id),
        db.from("travelers").select("*").eq("trip_id", id),
        db.from("task_groups").select("*").eq("trip_id", id),
        db.from("tasks").select("*").eq("trip_id", id),
        db.from("bags").select("*").eq("trip_id", id),
        db.from("packing_items").select("*").eq("trip_id", id),
        db.from("places").select("*").eq("trip_id", id),
        db.from("trip_days").select("*").eq("trip_id", id),
        db.from("stops").select("*").eq("trip_id", id),
        db.from("bookings").select("*").eq("trip_id", id),
        db.from("purchases").select("*").eq("trip_id", id),
        db.from("trip_notes").select("*").eq("trip_id", id),
        db.from("journal_entries").select("*").eq("trip_id", id),
        db.from("activity").select("*").eq("trip_id", id).order("created_at", { ascending: false }).limit(ACTIVITY_LIMIT),
      ]);
      const firstError = [trip, members, travelers, groups, tasks, bags, packing, places, days, stops, bookings, purchases, notes, journal, activity].find((r) => r.error)?.error;
      if (firstError) throw firstError;
      const userId = auth.user?.id ?? "";
      const ops = userId ? await readOutbox(userId, id) : [];
      const withPending = <K extends ListKey, T extends { id: string }>(key: K, rows: T[]) =>
        sortList(key, applyPending(rows as unknown as Row[], ops, key, id)) as unknown as TripSnapshot[K];
      if (!trip.data) {
        this.set({ status: "not_found" });
        return;
      }
      this.snap = { ...this.snap, me: { ...this.snap.me, userId: auth.user?.id ?? "" } };
      this.set({
        status: "ready",
        trip: trip.data,
        members: (members.data ?? []) as unknown as Member[],
        // Changes still waiting in the outbox are laid on top, so a checked box
        // doesn't flip back until it's sent.
        travelers: withPending("travelers", travelers.data ?? []),
        taskGroups: withPending("taskGroups", groups.data ?? []),
        tasks: withPending("tasks", tasks.data ?? []),
        bags: withPending("bags", bags.data ?? []),
        packing: withPending("packing", packing.data ?? []),
        places: withPending("places", places.data ?? []),
        days: withPending("days", days.data ?? []),
        stops: withPending("stops", stops.data ?? []),
        bookings: withPending("bookings", bookings.data ?? []),
        purchases: withPending("purchases", purchases.data ?? []),
        notes: withPending("notes", notes.data ?? []),
        journal: withPending("journal", journal.data ?? []),
        activity: activity.data ?? [],
        syncedAt: new Date().toISOString(),
        pending: ops.length,
      });
    } catch (e) {
      if (this.snap.status === "ready") {
        // Showing the copy on this device; the badge says since when.
        if (isNetworkError(e as { message?: string; code?: string })) this.set({ live: false });
        else console.error("trip load failed", e);
        return;
      }
      console.error("trip load failed", e);
      this.set({ status: "error" });
    }
  }

  private listen() {
    const db = supabase();
    const filter = `trip_id=eq.${this.tripId}`;
    let ch = db.channel(`trip:${this.tripId}`);
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `id=eq.${this.tripId}` }, (p) => {
      if (p.eventType === "UPDATE") this.set({ trip: p.new as TripSnapshot["trip"] });
    });
    for (const [key, table] of Object.entries(TABLES) as [ListKey, string][]) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table, filter }, (p) => {
        if (p.eventType === "DELETE") this.removeLocal(key, (p.old as Row).id);
        else this.upsertLocal(key, p.new as Row);
      });
    }
    ch = ch.on("postgres_changes", { event: "*", schema: "public", table: "trip_members", filter }, () => {
      // Members carry a joined profile; refetch rather than patch.
      void this.reloadMembers();
    });
    ch = ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "activity", filter }, (p) => {
      this.set({ activity: [p.new as Activity, ...this.snap.activity].slice(0, ACTIVITY_LIMIT) });
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // A re-subscribe means we were disconnected: send what waited, then reload.
        if (this.wasSubscribed) void this.reconnect();
        this.wasSubscribed = true;
        this.set({ live: true });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.set({ live: false });
      }
    });
    this.channel = ch;
  }

  private async reloadMembers() {
    const { data } = await supabase()
      .from("trip_members")
      .select("*, profile:profiles(display_name, avatar_color)")
      .eq("trip_id", this.tripId);
    if (data) this.set({ members: data as unknown as Member[] });
  }

  // --- Local state -----------------------------------------------------------
  upsertLocal(key: ListKey, row: Row) {
    const list = this.snap[key] as unknown as Row[];
    const i = list.findIndex((r) => r.id === row.id);
    const next = i >= 0 ? list.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [...list, row];
    this.set({ [key]: sortList(key, next) } as Partial<TripSnapshot>);
  }

  removeLocal(key: ListKey, id: string) {
    const list = this.snap[key] as unknown as Row[];
    this.set({ [key]: list.filter((r) => r.id !== id) } as Partial<TripSnapshot>);
  }

  setTripLocal(patch: Partial<NonNullable<TripSnapshot["trip"]>>) {
    if (this.snap.trip) this.set({ trip: { ...this.snap.trip, ...patch } });
  }
}
