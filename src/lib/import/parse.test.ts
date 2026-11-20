import { describe, expect, it } from "vitest";
import { itemTitle } from "../tripdata/schemas";
import { parseAnswer, parsePlainList } from "./parse";

describe("parseAnswer", () => {
  it("prefers the tripdata block over other JSON in the answer", () => {
    const text = 'Example: {"kind":"tasks","items":[{"title":"wrong"}]}\n```tripdata\n{"kind":"tasks","items":[{"title":"right"}]}\n```';
    const r = parseAnswer(text, "tasks");
    expect(r.ok && r.items.map((i) => itemTitle(r.kind, i))).toEqual(["right"]);
  });

  it("keeps valid items and counts invalid ones", () => {
    const r = parseAnswer('```tripdata\n{"kind":"packing","items":[{"title":"a","qty":"x"},{"qty":2},{"title":"b","qty":3}]}\n```', "packing");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items.map((i) => itemTitle(r.kind, i))).toEqual(["a", "b"]);
      expect(r.invalid).toBe(1);
      expect((r.items[0] as { qty?: number }).qty).toBeUndefined(); // bad qty dropped, item kept
    }
  });

  it("drops non-http links instead of rejecting the task", () => {
    const r = parseAnswer('{"kind":"tasks","items":[{"title":"t","link":"javascript:alert(1)"}]}', "tasks");
    expect(r.ok && (r.items[0] as { link?: string }).link).toBeUndefined();
  });

  it("uses the kind from the answer even if another was expected", () => {
    const r = parseAnswer('{"kind":"tasks","items":[{"title":"t"}]}', "packing");
    expect(r.ok && r.kind).toBe("tasks");
  });

  it("reports empty input", () => {
    expect(parseAnswer("   ")).toEqual({ ok: false, reason: "empty" });
  });
});

describe("parsePlainList", () => {
  it("strips bullets, numbers and checkboxes, reads quantities", () => {
    const list = parsePlainList("- מעיל ×4\n2) נעליים\n[ ] מתאם x2\n☐ כובע\n\n• 3x גרביים\n* כרית");
    expect(list).toEqual([
      { title: "מעיל", qty: 4 },
      { title: "נעליים" },
      { title: "מתאם", qty: 2 },
      { title: "כובע" },
      { title: "גרביים", qty: 3 },
      { title: "כרית" },
    ]);
  });
});

describe("phase 3 kinds", () => {
  it("parses purchases with a numeric budget", () => {
    const r = parseAnswer('```tripdata\n{"v":1,"kind":"purchases","items":[{"title":"סאקה","for":"סבא","budget":3000,"where":"Don Quijote"}]}\n```', "purchases");
    expect(r.ok && r.kind).toBe("purchases");
    expect(r.ok && r.items[0]).toMatchObject({ title: "סאקה", for: "סבא", budget: "3000", where: "Don Quijote" });
  });
  it("parses notes", () => {
    const r = parseAnswer('```tripdata\n{"v":1,"kind":"notes","items":[{"kind":"phrase","title":"תודה","body":"arigatou"},{"title":""}]}\n```', "notes");
    expect(r.ok && r.items).toHaveLength(1);
    expect(r.ok && r.invalid).toBe(1);
  });
});
