import { describe, expect, it } from "vitest";
import { exampleBlock, exampleItem } from "./example";
import { categoryKey, IMPORTABLE_KINDS, ITEM_SCHEMAS } from "./schemas";
import { parseAnswer } from "../import/parse";

describe("example and schema stay in sync", () => {
  it.each(IMPORTABLE_KINDS)("%s example validates and covers every field", (kind) => {
    const item = exampleItem(kind);
    expect(ITEM_SCHEMAS[kind].safeParse(item).success).toBe(true);
    expect(Object.keys(item).sort()).toEqual(Object.keys(ITEM_SCHEMAS[kind].shape).sort());
  });

  it.each(IMPORTABLE_KINDS)("the %s example block round-trips through the parser", (kind) => {
    const r = parseAnswer(`intro\n${exampleBlock(kind)}\n`, kind);
    expect(r.ok && r.via).toBe("tripdata");
  });
});

describe("categoryKey", () => {
  it("maps Hebrew and English names", () => {
    expect(categoryKey("ביגוד")).toBe("clothing");
    expect(categoryKey("Electronics")).toBe("electronics");
    expect(categoryKey("עזרה ראשונה")).toBe("meds");
    expect(categoryKey("משהו אחר לגמרי")).toBe("other");
    expect(categoryKey(undefined)).toBe("other");
  });
});
