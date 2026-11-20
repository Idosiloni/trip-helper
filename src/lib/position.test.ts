import { describe, expect, it } from "vitest";
import { byPosition, keyAfter, keyBetween, keysAfter, lastKey } from "./position";

describe("position keys", () => {
  it("sorts as plain strings (COLLATE C)", () => {
    const keys = [keyAfter(null)];
    keys.push(keyAfter(keys[0]));
    keys.push(keyBetween(keys[0], keys[1]));
    const items = keys.map((position) => ({ position }));
    expect(items.sort(byPosition).map((i) => i.position)).toEqual([keys[0], keys[2], keys[1]]);
  });

  it("appends batches after the last key", () => {
    const last = lastKey([{ position: "a0" }, { position: "a3" }, { position: "a1" }]);
    expect(last).toBe("a3");
    const next = keysAfter(last, 3);
    expect(next).toHaveLength(3);
    expect(next.every((k) => k > "a3")).toBe(true);
  });
});
