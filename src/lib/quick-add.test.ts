import { describe, expect, it } from "vitest";
import { parsePackingQuickAdd, parseTaskQuickAdd } from "./quick-add";

const T = [
  { id: "mom", label: "אמא" },
  { id: "noa", label: "נועה" },
];

describe("task quick add", () => {
  it("reads a date and an assignee", () => {
    expect(parseTaskQuickAdd("להזמין מלון עד 20.12 @אמא", "2026-11-18", T)).toEqual({ title: "להזמין מלון", due: "2026-12-20", assignee: "mom" });
  });
  it("rolls a past day/month to next year, keeps explicit years", () => {
    expect(parseTaskQuickAdd("ביטוח 3/1", "2026-11-18", T).due).toBe("2027-01-03");
    expect(parseTaskQuickAdd("ביטוח 3.1.2028", "2026-11-18", T).due).toBe("2028-01-03");
  });
  it("understands today / tomorrow", () => {
    expect(parseTaskQuickAdd("לקנות eSIM מחר", "2026-11-18", T)).toMatchObject({ title: "לקנות eSIM", due: "2026-11-19" });
  });
  it("leaves unknown @names and plain text alone", () => {
    expect(parseTaskQuickAdd("לשאול @דוד על הרכב", "2026-11-18", T)).toEqual({ title: "לשאול @דוד על הרכב", due: null, assignee: null });
    expect(parseTaskQuickAdd("JR Pass ל-7 ימים", "2026-11-18", T).due).toBeNull();
  });
});

describe("packing quick add", () => {
  it("splits by commas, reads ×N, guesses categories", () => {
    expect(parsePackingQuickAdd("גרביים ×5, מטען לטלפון, דרכונים, אקמול")).toEqual([
      { title: "גרביים", qty: 5, category: "clothing" },
      { title: "מטען לטלפון", qty: 1, category: "electronics" },
      { title: "דרכונים", qty: 1, category: "documents" },
      { title: "אקמול", qty: 1, category: "meds" },
    ]);
  });
  it("one plain item stays one item", () => {
    expect(parsePackingQuickAdd("משקפי שמש")).toEqual([{ title: "משקפי שמש", qty: 1, category: "other" }]);
  });
});
