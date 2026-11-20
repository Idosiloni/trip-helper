import { describeTravelers, type PromptContext } from "../context";

export const P10_VERSION = 1;

export type PlaceQuestion = { name: string; city: string | null; area: string | null; date: string | null; lodgingArea: string | null };

/** Prompt 10: a question about one place. Free-text answer (saved as a note). */
export function buildP10(ctx: PromptContext, place: PlaceQuestion): string {
  const lang = ctx.profile.answerLanguage === "he" ? "עברית" : "אנגלית";
  const where = [place.name, place.area, place.city].filter(Boolean).join(", ");
  const lines = [
    `שאלה על מקום אחד בטיול: ${where}.`,
    `מטיילים: ${describeTravelers(ctx)}`,
  ];
  if (place.date) lines.push(`מתוכנן ל-${place.date}.`);
  if (place.lodgingArea) lines.push(`הלינה שלנו באותו יום באזור ${place.lodgingArea}.`);
  lines.push(
    "",
    "תענה בקצרה ובנקודות:",
    "1. איך מגיעים" + (place.lodgingArea ? " מאזור הלינה" : "") + " ובכמה זמן",
    "2. כמה זמן כדאי להקדיש",
    "3. מתי הכי כדאי להגיע (שעה, יום, עומס)",
    "4. האם צריך להזמין או לקנות כרטיס מראש",
    "5. טיפ אחד שכדאי לדעת",
    "",
    `כתוב ב${lang}. בלי בלוק קוד.`,
  );
  return lines.join("\n");
}
