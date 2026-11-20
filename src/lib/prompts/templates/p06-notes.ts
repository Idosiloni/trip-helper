import { describeDates, describeRoute, describeTravelers, type PromptContext } from "../context";
import { formatInstructions } from "../format";

export const P06_VERSION = 1;

/** Prompt 6: phrases, tips, money and etiquette, as short cards (SPEC 6.8). */
export function buildP06(ctx: PromptContext): string {
  const lines = [
    "תכין לנו כרטיסיות מידע קצרות לטיול, שנוכל לקרוא בטלפון באמצע הרחוב.",
    "",
    `יעד: ${describeRoute(ctx)}`,
    `תאריכים: ${describeDates(ctx)}`,
    `מטיילים: ${describeTravelers(ctx)}`,
    "",
    "מה לכלול:",
    "- 10 עד 15 ביטויים שימושיים (שלום, תודה, סליחה, כמה זה עולה, איפה השירותים, אלרגיות, בלי בשר, חשבון בבקשה).",
    "- מספרי חירום מקומיים (משטרה, אמבולנס) ואיך מגיעים לשגרירות ישראל.",
    "- כסף: מטבע, שער בערך, כרטיס או מזומן, טיפים למלצרים.",
    "- נימוסים וכללי התנהגות חשובים, במיוחד עם ילדים.",
    "- כמה טיפים מעשיים (תחבורה, מים, שקעים, אפליקציות שימושיות).",
  ];
  if (ctx.existing.length) lines.push("", "כבר יש לנו את אלה:", ...ctx.existing.slice(0, 100).map((n) => `- ${n}`));
  lines.push("", formatInstructions("notes", ctx.profile.answerLanguage));
  return lines.join("\n");
}
