import { describeDates, describeStyle, describeTravelers, type PromptContext } from "../context";
import { formatInstructions } from "../format";

export const P02_VERSION = 2;

/** Prompt 2: what to see and eat in a city (or one neighborhood). */
export function buildP02(ctx: PromptContext, city: string, area?: string): string {
  const where = area ? `${area}, ${city}` : city;
  const existing = (ctx.plan?.places ?? []).filter((p) => !city || p.city === city).map((p) => p.name);
  const lines = [
    `מה כדאי לראות, לאכול ולעשות ב${where}?`,
    "",
    `תאריכים: ${describeDates(ctx)}`,
    `מטיילים: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
    "",
    "תן בערך 10 עד 15 מקומות: אטרקציות, אוכל (גם מקומי ופשוט), קניות וטבע, עם התאמה לעונה ולגילאים.",
    "סמן כ-must רק את מה שבאמת אסור לפספס.",
    "name: השם כמו שהוא מופיע בגוגל מפות, כדי שנמצא אותו בחיפוש.",
    "area: השכונה לכל מקום. ככה נוכל לקבץ מקומות קרובים לאותו יום.",
    "why: משפט אחד, מה מיוחד ומה לא לפספס בתוכו. אם צריך להזמין מראש, אם סגור ביום מסוים, או אם מזומן בלבד, לכתוב את זה במילים האלה.",
  ];
  if (existing.length) lines.push("", "כבר יש לנו את אלה, אל תחזור עליהם:", ...existing.slice(0, 100).map((n) => `- ${n}`));
  lines.push("", formatInstructions("places", ctx.profile.answerLanguage));
  return lines.join("\n");
}
