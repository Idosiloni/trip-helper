import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps in-app paths", () => {
    expect(safeNext("/trips/abc/today?x=1")).toBe("/trips/abc/today?x=1");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "", null, undefined, "trips"])("rejects %s", (v) => {
    expect(safeNext(v)).toBe("/trips");
  });
});
