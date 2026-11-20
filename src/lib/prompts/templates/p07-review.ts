import { describeRoute, describeStyle, describeTravelers, type PromptContext } from "../context";
import { formatInstructions } from "../format";
import { describeBookings, describePlan } from "./plan-text";

export const P07_VERSION = 1;

/** Prompt 7: is this itinerary realistic? Returns corrected days (shown as a comparison). */
export function buildP07(ctx: PromptContext): string {
  const lines = [
    "תבדוק בבקשה את המסלול שלנו ותגיד אם הוא ריאלי.",
    "",
    `יעד: ${describeRoute(ctx)}`,
    `מטיילים: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
    "",
    "המסלול:",
    describePlan(ctx),
  ];
  const bookings = describeBookings(ctx);
  if (bookings) lines.push("", "הזמנות קבועות:", bookings);
  lines.push(
    "",
    "בדוק: עומס יתר, מרחקים וזמני נסיעה בין עצירות, שעות פתיחה וימי סגירה, סדר גאוגרפי, ומה חסר (ארוחות, מנוחה).",
    "קודם הסבר בקצרה מה הבעיות. אחר כך החזר בבלוק **רק את הימים שצריך לשנות**, כל יום במלואו (כל העצירות שלו בסדר החדש).",
    "",
    formatInstructions("itinerary", ctx.profile.answerLanguage),
  );
  return lines.join("\n");
}
