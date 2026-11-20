import { describeStyle, describeTravelers, type PromptContext } from "../context";
import { formatInstructions } from "../format";
import { describePlan } from "./plan-text";

export const P09_VERSION = 1;

/** Prompt 9: change one day's plan (rain, tired, something closed). Returns that day only. */
export function buildP09(ctx: PromptContext, date: string, reason: string): string {
  const lines = [
    `צריך לשנות את התוכנית ליום ${date}. הסיבה: ${reason || "משהו השתנה"}`,
    "",
    `מטיילים: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
    "",
    "התוכנית הנוכחית ליום הזה:",
    describePlan(ctx, { onlyDates: [date] }),
    "",
    "תציע תוכנית חלופית ליום הזה בלבד, באותו אזור, שמתאימה לסיבה. אפשר לשמור עצירות שעדיין מתאימות.",
    `החזר בבלוק רק את היום ${date}, במלואו (כל העצירות בסדר החדש).`,
    "",
    formatInstructions("itinerary", ctx.profile.answerLanguage),
  ];
  return lines.join("\n");
}
