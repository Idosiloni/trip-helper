import { keysAfter } from "../position";
import type { PackingCategory } from "../tripdata/schemas";

// Templates: a starting point for a new trip's lists (SPEC §16 `templates`).
// Built-in ones live here; "mine" are rows in `templates` with the same payload shape.

export type TemplatePayload = {
  task_groups?: { key: string; title: string; position: string }[];
  tasks?: { title: string; notes?: string | null; link?: string | null; phase?: "before" | "during" | "after"; group?: string | null; position: string }[];
  packing?: { title: string; category: string; qty?: number; notes?: string | null; position: string }[];
  notes?: { kind: string; title: string; body?: string | null; position: string }[];
};

export type BuiltinTemplate = { id: string; name: string; description: string; payload: TemplatePayload };

type Group = { title: string; tasks: (string | { title: string; phase: "before" | "during" | "after" })[] };

function build(groups: Group[], packing: [PackingCategory, string, number?][]): TemplatePayload {
  const gKeys = keysAfter(null, groups.length);
  const all = groups.flatMap((g, gi) => g.tasks.map((x) => ({ x, group: `g${gi}` })));
  const tKeys = keysAfter(null, all.length);
  const pKeys = keysAfter(null, packing.length);
  return {
    task_groups: groups.map((g, i) => ({ key: `g${i}`, title: g.title, position: gKeys[i] })),
    tasks: all.map(({ x, group }, i) => ({
      title: typeof x === "string" ? x : x.title,
      phase: typeof x === "string" ? "before" : x.phase,
      group,
      position: tKeys[i],
    })),
    packing: packing.map(([category, title, qty], i) => ({ category, title, qty: qty ?? 1, position: pKeys[i] })),
  };
}

const ABROAD = build(
  [
    { title: "מסמכים", tasks: ["לבדוק תוקף דרכונים (לפחות 6 חודשים)", "לבדוק אם צריך ויזה", "ביטוח נסיעות לכל המשפחה", "צילום דרכונים לטלפון ולמייל"] },
    { title: "הזמנות", tasks: ["טיסות", "לינה לכל הלילות", "רכב או כרטיס תחבורה", "אטרקציות שצריך להזמין מראש"] },
    { title: "כסף וטלפון", tasks: ["כרטיס אשראי בלי עמלת המרה", "מעט מזומן במטבע המקומי", "eSIM או חבילת גלישה", "להודיע לבנק על נסיעה"] },
    {
      title: "לפני היציאה",
      tasks: ["צ'ק-אין לטיסה", "להוריד מפות לשימוש בלי אינטרנט", "הסעה לשדה", "להשקות עציצים ולסדר את הבית"],
    },
    { title: "אחרי", tasks: [{ title: "לגבות תמונות", phase: "after" }, { title: "לכתוב סיכום ביומן", phase: "after" }] },
  ],
  [
    ["documents", "דרכונים"],
    ["documents", "ביטוח נסיעות (מודפס או בטלפון)"],
    ["documents", "כרטיסי אשראי"],
    ["electronics", "מטענים"],
    ["electronics", "מתאם חשמל"],
    ["electronics", "סוללה ניידת"],
    ["clothing", "תחתונים וגרביים", 7],
    ["clothing", "חולצות", 5],
    ["clothing", "מכנסיים", 3],
    ["clothing", "פיג'מה"],
    ["clothing", "מעיל או סווטשירט"],
    ["clothing", "נעלי הליכה"],
    ["toiletries", "מברשות שיניים ומשחה"],
    ["toiletries", "קרם הגנה"],
    ["meds", "תרופות קבועות"],
    ["meds", "משכך כאבים ופלסטרים"],
    ["other", "בקבוק מים"],
  ],
);

const WEEKEND = build(
  [
    { title: "הזמנות", tasks: ["לינה", "כרטיסים או הזמנות למקומות"] },
    { title: "לפני היציאה", tasks: ["לבדוק מזג אוויר", "לתכנן מסלול נסיעה"] },
  ],
  [
    ["clothing", "בגדים להחלפה", 2],
    ["clothing", "פיג'מה"],
    ["toiletries", "מברשות שיניים"],
    ["electronics", "מטענים"],
    ["meds", "תרופות קבועות"],
    ["other", "חטיפים לדרך"],
  ],
);

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  { id: "builtin:abroad", name: "טיול משפחתי לחו״ל", description: "משימות לפני הטיסה וציוד בסיסי", payload: ABROAD },
  { id: "builtin:weekend", name: "סוף שבוע קצר", description: "רשימה קצרה לנסיעה של יומיים-שלושה", payload: WEEKEND },
];

export function templateCounts(p: TemplatePayload) {
  return { tasks: p.tasks?.length ?? 0, packing: p.packing?.length ?? 0, notes: p.notes?.length ?? 0 };
}
