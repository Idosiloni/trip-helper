import { describeDates, describeTravelers, type PromptContext } from "../context";
import { FIELD_HELP } from "../format";
import { exampleBlock } from "../../tripdata/example";

export const P13_VERSION = 3;

/** Long plans are fine: a 2-week family doc is ~40k characters. */
export const P13_MAX_PLAN = 100_000;

const PROFILE_EXAMPLE = {
  v: 1,
  kind: "profile",
  overview: "טיול של 14 יום בקצב רגוע. מתחילים בטוקיו ליד השדה, עוברים להרים ומסיימים בקיוטו. בדצמבר הימים קצרים, אז הפעילויות בחוץ בבוקר.",
  destinations: [{ country: "יפן", cities: [{ name: "טוקיו", from: "2027-04-01", to: "2027-04-05", area: "Shinjuku" }] }],
  travelers: [{ name: "אבא" }, { name: "נועה", age: 8, interests: ["אנימה"] }],
};
const BOOKINGS_EXAMPLE = {
  v: 1,
  kind: "bookings",
  items: [
    { kind: "flight", title: "תל אביב ← אבו דאבי (XY 101)", start: "2027-03-31 06:20", tz: "Asia/Jerusalem", end: "2027-03-31 10:00", end_tz: "Asia/Dubai", note: "" },
    { kind: "hotel", title: "Hotel Gracery Shinjuku", start: "2027-04-01 15:00", tz: "Asia/Tokyo", end: "2027-04-05 11:00", end_tz: "Asia/Tokyo", cancel_by: "2027-03-29", note: "" },
  ],
};
const block = (o: unknown) => "```tripdata\n" + JSON.stringify(o, null, 2) + "\n```";

/**
 * Prompt 13: "we already have a plan". Turns a long free-form plan (a doc, a chat,
 * an email) into one block per part of the app, so it can be imported in one go.
 */
export function buildP13(ctx: PromptContext, planText: string): string {
  const lang = ctx.profile.answerLanguage === "he" ? "עברית" : "אנגלית";
  const kinds = ["places", "itinerary", "tasks", "packing", "notes"] as const;
  return [
    "יש לנו תוכנית טיול שכבר הכנו. תסדר אותה בשבילנו לפורמט שאפליקציית הטיול שלנו יודעת לייבא.",
    "הכלל החשוב: שום דבר מהתוכנית לא הולך לאיבוד, ושום דבר לא מומצא.",
    "- שמות מלונות, מסעדות ומקומות: בדיוק כמו בתוכנית. לא להחליף, לא להציע חלופות, לא להוסיף מקומות.",
    "- שעות: כמו שכתובות בתוכנית. אם אין שעה, רק בוקר, צהריים או ערב.",
    "- כל מה שלא שייך ליום מסוים (טבלאות, רשימות, טיפים, לוגיסטיקה, אוכל, כסף, שאלות פתוחות) נכנס לבלוק notes או tasks, עם התוכן המלא.",
    "",
    `הטיול באפליקציה: ${ctx.tripName}`,
    `תאריכים באפליקציה: ${describeDates(ctx)}`,
    ctx.travelers.length ? `מטיילים שכבר רשומים: ${describeTravelers(ctx)}` : "עוד לא רשומים מטיילים.",
    "",
    "התוכנית שלנו:",
    '"""',
    planText.trim().slice(0, P13_MAX_PLAN),
    '"""',
    "",
    `תענה ב${lang}. משפט או שניים של סיכום, ואחריהם כמה בלוקים של קוד עם השפה tripdata, בלוק לכל חלק שיש לו מידע בתוכנית, בסדר הזה:`,
    "אם התשובה ארוכה מדי להודעה אחת: עצור אחרי בלוק שלם, וכתוב בסוף \"יש עוד, כתבו המשך\". אל תקצר ואל תדלג על ימים כדי להספיק.",
    "",
    "1. profile: יעדים, ערים לפי הסדר עם תאריכים, ומי נוסע.",
    block(PROFILE_EXAMPLE),
    "   - overview: פסקה אחת: אופי הטיול, היגיון המסלול (למה הסדר הזה), והערות תזמון חשובות לכל הטיול. מתוך התוכנית בלבד.",
    "   - age: גיל במספרים, רק אם כתוב. interests: רק אם כתוב.",
    "",
    "2. places: רק מקומות שמוזכרים מחוץ לימים (המלצות, רשימות אוכל, בתי קפה, חנויות) ומלונות כ\"לינה\". מקומות שכבר בימים לא צריך לכתוב פעמיים.",
    "   - טיסות, רכבות, נחיתה ושדות תעופה הם לא מקומות: הם הולכים ל-bookings.",
    "   - city: עיר אחת בלבד, בלי \"/\". יום נסיעה: העיר שבה המקום נמצא.",
    exampleBlock("places"),
    ...FIELD_HELP.places.map((l) => `   - ${l}`),
    "",
    "3. itinerary: כל עצירה בכל יום, לפי הסדר, בלי לדלג. אותם שמות מקומות בדיוק כמו בבלוק places.",
    "   - day_summary: המשפט שמסביר את היום, אם יש בתוכנית. plan_b: חלופות ו\"אם לא רוצים / אם סגור / אם יורד גשם\" של אותו יום.",
    "   - עצירה שכתוב עליה אופציונלי או \"אם יש כוח\": optional: true.",
    "   - מלון: פריט \"לינה\" ביום שמגיעים אליו, עם השם המדויק מהתוכנית.",
    exampleBlock("itinerary"),
    ...FIELD_HELP.itinerary.map((l) => `   - ${l}`),
    "",
    "4. bookings: טיסות, מלונות, רכבות, השכרת רכב וכרטיסים שכבר הוזמנו.",
    "   - טיסה עם עצירת ביניים: כל קטע בנפרד, עם מספר הטיסה בכותרת ושעות מקומיות של כל צד.",
    "   - מלון: השם המדויק מהתוכנית, צ'ק-אין וצ'ק-אאוט. לא לנחש מלון שלא כתוב.",
    "   - cancel_by: YYYY-MM-DD, היום האחרון לביטול חינם, אם כתוב. address ו-price: אם כתובים.",
    block(BOOKINGS_EXAMPLE),
    "   - kind: flight / hotel / train / car / attraction / other",
    "   - start / end: YYYY-MM-DD HH:MM בשעון המקומי של המקום. tz / end_tz: אזור זמן IANA (למשל Asia/Tokyo).",
    "   - בלי מספרי הזמנה, קודי אישור, מספרי דרכון או פרטי תשלום.",
    "",
    "5. tasks: מה צריך לעשות לפני הטיול ובמהלכו: הזמנות מראש (עם תאריך יעד), משלוח מזוודות, אישורי כניסה, ושאלות פתוחות שצריך להחליט.",
    exampleBlock("tasks"),
    "",
    "6. packing: ציוד, אם מוזכר.",
    exampleBlock("packing"),
    "",
    "7. notes: כל השאר, כרטיסייה לכל נושא עם התוכן המלא: לוגיסטיקה ורכבות, כסף ומיסים, אוכל, בתי קפה, קניות, טיפים לעונה, ביטויים. טבלה מהתוכנית: כשורות בתוך body.",
    exampleBlock("notes"),
    "",
    `- בכל בלוק kind אחד מ: profile, ${kinds.join(", ")}, bookings.`,
    "- JSON תקין, בלי הערות בתוך הבלוקים. חלק שאין עליו מידע: לא לכתוב לו בלוק.",
  ].join("\n");
}
