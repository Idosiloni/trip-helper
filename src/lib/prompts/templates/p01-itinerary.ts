import { describeDates, describeRoute, describeStyle, describeTravelers, type PromptContext } from "../context";
import { formatInstructions } from "../format";
import { describeBookings, describePlan, describeWantedPlaces } from "./plan-text";

export const P01_VERSION = 3;

/** Prompt 1: itinerary skeleton by day (for an empty plan, or only some days). */
export function buildP01(ctx: PromptContext, onlyDates?: string[]): string {
  const lines = [
    onlyDates?.length ? "אני צריך/ה תוכנית לימים מסוימים בטיול משפחתי." : "אני צריך/ה שלד מסלול לפי ימים לטיול משפחתי.",
    "",
    `יעד ומסלול: ${describeRoute(ctx)}`,
    `תאריכים: ${describeDates(ctx)}`,
    `מטיילים: ${describeTravelers(ctx)}`,
    ...describeStyle(ctx),
    "",
    onlyDates?.length ? "הימים לתכנון (וכרגע מה שיש בהם):" : "הימים כפי שהם כרגע:",
    describePlan(ctx, { onlyDates }),
  ];
  const wanted = describeWantedPlaces(ctx);
  if (wanted) lines.push("", "מקומות שכבר רצינו לראות (לשבץ אותם, עם אותו שם בדיוק):", wanted);
  const bookings = describeBookings(ctx);
  if (bookings) lines.push("", "הזמנות קבועות (לא להזיז):", bookings);
  lines.push(
    "",
    "איך לבנות כל יום:",
    "- עוגן אחד: הדבר שבשבילו היום קיים. סביבו 2 עד 4 עצירות נוספות קרובות, לפי סדר הגיוני גאוגרפית, עם ארוחת צהריים וערב כעצירות (מקום מסוים, לא \"ארוחה באזור\").",
    "- day_title: כותרת קצרה. day_summary: משפט או שניים על הכוונה של היום ולמה הסדר הזה, כמו שמסבירים לחבר.",
    "- time: בוקר, צהריים או ערב לכל עצירה. start רק כשיש שעה קבועה באמת: רכבת, כרטיס לשעה, פתיחה מוקדמת שחשובה. לא לכל עצירה.",
    "- plan_b: בפריט הראשון של כל יום, מה עושים אם יורד גשם, משהו סגור או כולם עייפים. חלופה אחת או שתיים, קרובות.",
    "- עצירה שאפשר לוותר עליה אם אין כוח: optional: true.",
    "- אל תעמיס. יום הגעה ויום עזיבה קלים. השאר זמן לנשום. יום טיול לעיר אחרת: city של העיר שמבקרים בה.",
    "- transport: איך מגיעים מהעצירה הקודמת, קצר. note: רק מה שבאמת עוזר במקום (להזמין מראש? סגור ביום מסוים? מזומן?).",
    "",
    "לינה: לילות שכתוב בהם \"לינה סגורה\" כבר סגורים. לא להציע להם מלון אחר. בלילות בלי לינה: לא להמציא מלון ולא לכתוב פריט לינה. אפשר להמליץ בטקסט החופשי באיזה אזור כדאי לישון ולמה.",
    "",
    "בטקסט החופשי לפני הבלוק: פסקה קצרה של היגיון המסלול (למה הסדר הזה), ורשימה קצרה של מה להזמין מראש ומתי. את פסקת ההיגיון כתוב גם בבלוק, בשדה overview ליד items.",
    "",
    formatInstructions("itinerary", ctx.profile.answerLanguage),
  );
  return lines.join("\n");
}
