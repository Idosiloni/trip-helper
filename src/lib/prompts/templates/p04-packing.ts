import { describeDates, describeRoute, describeStyle, describeTravelers, quotedNames, type PromptContext } from "../context";
import { formatInstructions } from "../format";

export const P04_VERSION = 2;

/** Prompt 4: packing list by destination, season, travelers, activities and luggage. */
export function buildP04(ctx: PromptContext): string {
  const l = ctx.profile.luggage;
  const luggage = [
    l.suitcases ? `${l.suitcases} מזוודות` : null,
    l.carryOns ? `${l.carryOns} תיקי עלייה למטוס` : null,
    l.weightKg ? `עד ${l.weightKg} ק"ג למזוודה` : null,
  ].filter(Boolean);
  const lines = [
    "אני צריך/ה רשימת ציוד לטיול משפחתי.",
    "",
    `יעד ומסלול: ${describeRoute(ctx)}`,
    `תאריכים: ${describeDates(ctx)}`,
    `מטיילים: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
  ];
  if (luggage.length) lines.push(`מטען: ${luggage.join(", ")}`);
  if (ctx.weatherSummary?.length) lines.push("מזג האוויר הצפוי:", ...ctx.weatherSummary.map((w) => `- ${w}`));
  if (ctx.bags.length) lines.push(`תיקים: ${ctx.bags.join(", ")}`);
  lines.push(
    "",
    ctx.weatherSummary?.length
      ? "תכין רשימת ציוד לפי מזג האוויר שלמעלה, הגילאים והפעילויות. כלול כמויות לפי מספר הלילות."
      : "תכין רשימת ציוד מותאמת למזג האוויר הצפוי בעונה וביעד, לגילאים ולפעילויות. כלול כמויות לפי מספר הלילות.",
    "פריטים אישיים שייך למטייל, ופריטים משותפים (מטען, מתאם חשמל, ערכת עזרה ראשונה) ל\"כולם\".",
    `ערכים אפשריים לשדה for: ${quotedNames(ctx)}.`,
    "בלי פריטים מובנים מאליהם כמו \"ארנק\" או \"טלפון\", אלא אם יש סיבה מיוחדת ליעד.",
  );
  if (ctx.existing.length) {
    lines.push("", "כבר יש ברשימה שלנו, אל תחזור על אלה:", ...ctx.existing.slice(0, 120).map((t) => `- ${t}`));
  }
  lines.push("", formatInstructions("packing", ctx.profile.answerLanguage));
  return lines.join("\n");
}
