import { beforeEach, describe, expect, it } from "vitest";
import { memoryKV, setKV } from "./kv";
import { applyPending, enqueue, isNetworkError, readOutbox, removeOp } from "./outbox";

const base = { userId: "u1", tripId: "t1", key: "tasks", table: "tasks" };

describe("outbox", () => {
  beforeEach(() => setKV(memoryKV()));

  it("merges patches to the same row, newest field wins", async () => {
    await enqueue({ ...base, rowId: "a", kind: "patch", values: { done: true } });
    await enqueue({ ...base, rowId: "b", kind: "patch", values: { done: true } });
    await enqueue({ ...base, rowId: "a", kind: "patch", values: { done: false, title: "x" } });
    const ops = await readOutbox("u1", "t1");
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ rowId: "a", values: { done: false, title: "x" } });
  });

  it("folds a patch into a pending insert", async () => {
    await enqueue({ ...base, key: "notes", table: "trip_notes", rowId: "n", kind: "insert", values: { title: "a", position: "a0" } });
    await enqueue({ ...base, key: "notes", table: "trip_notes", rowId: "n", kind: "patch", values: { body: "b" } });
    const ops = await readOutbox("u1", "t1");
    expect(ops).toEqual([expect.objectContaining({ kind: "insert", values: { title: "a", position: "a0", body: "b" } })]);
  });

  it("keeps users and trips apart, and removes sent ops", async () => {
    await enqueue({ ...base, rowId: "a", kind: "patch", values: { done: true } });
    await enqueue({ ...base, userId: "u2", rowId: "a", kind: "patch", values: { done: false } });
    expect(await readOutbox("u2", "t1")).toHaveLength(1);
    const [op] = await readOutbox("u1", "t1");
    await removeOp("u1", "t1", op.seq);
    expect(await readOutbox("u1", "t1")).toEqual([]);
  });

  it("lays pending changes over fresh server rows", () => {
    const rows = [{ id: "a", done: false, title: "t" }];
    const out = applyPending(rows, [
      { ...base, seq: 1, rowId: "a", kind: "patch", values: { done: true } },
      { ...base, seq: 2, rowId: "z", kind: "insert", values: { title: "new" } },
      { ...base, seq: 3, key: "packing", rowId: "a", kind: "patch", values: { title: "other list" } },
    ], "tasks", "t1");
    expect(out).toEqual([{ id: "a", done: true, title: "t" }, { id: "z", trip_id: "t1", title: "new" }]);
  });

  it("tells network failures from refusals", () => {
    expect(isNetworkError({ message: "TypeError: Failed to fetch", code: "" })).toBe(true);
    expect(isNetworkError({ message: "Load failed" })).toBe(true);
    expect(isNetworkError(null, 0)).toBe(true);
    expect(isNetworkError({ message: "new row violates row-level security policy", code: "42501" })).toBe(false);
  });
});
