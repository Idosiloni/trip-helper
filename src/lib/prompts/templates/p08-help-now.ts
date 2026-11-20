import { describeRoute, describeStyle, describeTravelers, type PromptContext } from "../context";
import { formatInstructions } from "../format";

export const P08_VERSION = 1;

export type HelpNow = {
  /** What we're looking for, in the user's words ("מקום לאכול", "שירותים"). */
  looking: string;
  /** Local wall-clock time, "14:20". */
  time: string;
  /** Today's city (from the itinerary) if known. */
  city: string | null;
  /** Rounded coordinates, only when the user chose to share them. */
  coords?: { lat: number; lng: number } | null;
};

/** Prompt 8: "help now", during the trip (SPEC 7.4). Answers come back as places. */
export function buildP08(ctx: PromptContext, h: HelpNow): string {
  const today = ctx.plan?.days.find((d) => d.date === ctx.today);
  const where = h.coords
    ? `${h.coords.lat.toFixed(3)}, ${h.coords.lng.toFixed(3)}${h.city ? ` (${h.city})` : ""}`
    : (h.city ?? `לא ידוע בדיוק. הטיול: ${describeRoute(ctx)}`);
  const lines = [
    `אנחנו עכשיו בטיול. מחפשים: ${h.looking}`,
    "",
    `איפה אנחנו: ${where}`,
    `השעה עכשיו: ${h.time}`,
    `מי איתנו: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
  ];
  if (today?.weather) lines.push(`מזג האוויר היום: ${today.weather}`);
  if (today?.stops.length) {
    lines.push("", "מה מתוכנן להיום:", ...today.stops.map((s) => `- ${[s.start ?? s.timeOfDay, s.label].filter(Boolean).join(" ")}`));
  }
  lines.push(
    "",
    "תן 3 עד 6 אפשרויות קרובות, שפתוחות עכשיו, ומתאימות לנו. הקרובות ביותר קודם.",
    "לכל אפשרות: כמה זמן הליכה בערך, ולמה היא מתאימה.",
    "",
    formatInstructions("places", ctx.profile.answerLanguage),
  );
  return lines.join("\n");
}
