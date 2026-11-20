import { describeRoute, type PromptContext } from "../context";
import { formatInstructions } from "../format";

export const P05_VERSION = 1;

/** Prompt 5: gift and shopping ideas per person and budget (SPEC 6.4). */
export function buildP05(ctx: PromptContext): string {
  const lines = [
    "אנחנו בטיול משפחתי ורוצים לקנות מתנות ודברים מקומיים.",
    "",
    `יעד: ${describeRoute(ctx)}`,
    "",
    "תציע 10 עד 15 רעיונות: מתנות קטנות לחברים ולמשפחה, ודברים מקומיים ששווה לקנות לעצמנו.",
    "לכל רעיון: בשביל מי זה מתאים, תקציב משוער (במטבע המקומי ובשקלים), ואיפה בדרך כלל קונים (רשת, שוק, סוג חנות).",
    "העדף דברים שקל להכניס למזוודה ושמותר להכניס לישראל.",
    "אם כתבתי בבקשה נוספת למי ובאיזה תקציב, תתאים את הרעיונות לזה.",
  ];
  if (ctx.existing.length) lines.push("", "כבר ברשימה שלנו, אל תחזור עליהם:", ...ctx.existing.slice(0, 100).map((n) => `- ${n}`));
  lines.push("", formatInstructions("purchases", ctx.profile.answerLanguage));
  return lines.join("\n");
}
