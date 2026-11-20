// Changes made without a connection (SPEC §10): kept on the device and sent
// in order when the connection is back. Field-level, so the last write wins
// per field. Pure logic here; sending lives in trip-data/sync.ts.
import { kv } from "./kv";

export type OutboxOp = {
  /** Sequence for ordering. */
  seq: number;
  userId: string;
  tripId: string;
  /** Snapshot list key ("tasks", "packing", ...). */
  key: string;
  table: string;
  rowId: string;
  kind: "insert" | "patch";
  values: Record<string, unknown>;
};

const k = (userId: string, tripId: string) => `outbox:${userId}:${tripId}`;

export async function readOutbox(userId: string, tripId: string): Promise<OutboxOp[]> {
  return ((await kv().get<OutboxOp[]>(k(userId, tripId))) ?? []).sort((a, b) => a.seq - b.seq);
}

async function write(userId: string, tripId: string, ops: OutboxOp[]) {
  if (ops.length) await kv().set(k(userId, tripId), ops);
  else await kv().del(k(userId, tripId));
}

/**
 * Adds a change. A patch to a row that already has a pending insert or patch
 * is merged into it (one request per row, newest field values win).
 */
export async function enqueue(op: Omit<OutboxOp, "seq">): Promise<OutboxOp[]> {
  const ops = await readOutbox(op.userId, op.tripId);
  const existing = ops.find((o) => o.table === op.table && o.rowId === op.rowId);
  if (existing && op.kind === "patch") {
    existing.values = { ...existing.values, ...op.values };
  } else {
    const seq = (ops.at(-1)?.seq ?? 0) + 1;
    ops.push({ ...op, seq });
  }
  await write(op.userId, op.tripId, ops);
  return ops;
}

export async function removeOp(userId: string, tripId: string, seq: number) {
  await write(userId, tripId, (await readOutbox(userId, tripId)).filter((o) => o.seq !== seq));
}

/** Rows as the user last saw them: server rows with pending changes laid on top. */
export function applyPending<T extends { id: string }>(rows: T[], ops: OutboxOp[], key: string, tripId: string): T[] {
  let out = rows;
  for (const op of ops) {
    if (op.key !== key) continue;
    const i = out.findIndex((r) => r.id === op.rowId);
    if (i >= 0) out = out.map((r, j) => (j === i ? { ...r, ...op.values } : r));
    else if (op.kind === "insert") out = [...out, { ...op.values, id: op.rowId, trip_id: tripId } as unknown as T];
  }
  return out;
}

/**
 * True when the device has no connection. In development only, setting
 * localStorage "th-fake-offline" to "1" pretends to be offline, to test the outbox.
 */
export function isOffline(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (process.env.NODE_ENV !== "production") {
    try {
      return localStorage.getItem("th-fake-offline") === "1";
    } catch {
      return false;
    }
  }
  return false;
}

/** Network failure (keep and queue) vs. the server saying no (roll back). */
export function isNetworkError(error: { message?: string; code?: string } | null, status?: number): boolean {
  if (isOffline()) return true;
  if (status === 0) return true;
  const msg = error?.message ?? "";
  return !error?.code && /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg);
}
