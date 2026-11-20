import { daysLeft, describeDates, describeRoute, describeStyle, describeTravelers, quotedNames, type PromptContext } from "../context";
import { formatInstructions } from "../format";

export const P03_VERSION = 2;

/** Prompt 3: to-do list before the trip (visa, eSIM, insurance, money...). */
export function buildP03(ctx: PromptContext): string {
  const left = daysLeft(ctx);
  const lines = [
    "אני מתכנן/ת טיול משפחתי ורוצה רשימת משימות מעשית להכנה.",
    "",
    `יעד ומסלול: ${describeRoute(ctx)}`,
    `תאריכים: ${describeDates(ctx)}${left !== null && left >= 0 ? `. נשארו ${left} ימים עד היציאה` : ""}`,
    `מטיילים: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
    "יוצאים מישראל, עם דרכונים ישראליים.",
    "",
    "תכין רשימת משימות שצריך לעשות לפני הטיול: כניסה וויזה, ביטוח נסיעות, תקשורת (eSIM), כסף ותשלומים, הזמנות שכדאי לסגור מראש, מסמכים, בריאות, ומה לסדר בבית.",
    "לכל משימה תן תאריך יעד ריאלי לפני היציאה (כמה זמן לפני שבאמת צריך: ויזה, חיסונים וכרטיסים מבוקשים מוקדם, eSIM וכסף בשבוע האחרון).",
    "for: \"כולם\" כברירת מחדל. שם מטייל רק למשימה אישית שלו.",
    "group: נושא קצר לכל משימה (מסמכים, כסף, תקשורת, הזמנות, בריאות, בית), כדי שהרשימה תהיה מסודרת.",
    "משימה אחת לכל פעולה, קצרה ומעשית. בלי משימות כלליות כמו \"לתכנן את הטיול\".",
    `ערכים אפשריים לשדה for: ${quotedNames(ctx)}.`,
    "דגש על מה שספציפי ליעד ולעונה, לא רשימה כללית.",
  ];
  if (ctx.existing.length) {
    lines.push("", "כבר יש לנו את המשימות האלה, אל תחזור עליהן:", ...ctx.existing.slice(0, 80).map((t) => `- ${t}`));
  }
  lines.push("", formatInstructions("tasks", ctx.profile.answerLanguage));
  return lines.join("\n");
}
