import type { PromptContext } from "../context";
import { describeDates } from "../context";

export const P14_VERSION = 2;

const EXAMPLE = {
  v: 1,
  kind: "bookings",
  items: [
    { kind: "flight", title: "תל אביב ← טוקיו (LY91)", start: "2027-03-31 22:30", tz: "Asia/Jerusalem", end: "2027-04-01 17:00", end_tz: "Asia/Tokyo", note: "טרמינל 3, מזוודה 23 ק״ג לאדם" },
    { kind: "hotel", title: "Hotel Gracery Shinjuku", start: "2027-04-01 15:00", tz: "Asia/Tokyo", end: "2027-04-05 11:00", end_tz: "Asia/Tokyo", address: "1-19-1 Kabukicho, Shinjuku, Tokyo", price: "¥96,000", cancel_by: "2027-03-29", note: "2 חדרים, ארוחת בוקר כלולה" },
  ],
};

/**
 * Prompt 14: confirmation emails (flights, hotels, trains, car, tickets) → one
 * bookings block. Codes, phones and emails are removed by redact() before copying.
 */
export function buildP14(ctx: PromptContext, emailText: string): string {
  const lang = ctx.profile.answerLanguage === "he" ? "עברית" : "אנגלית";
  return [
    "אלה אישורי הזמנה של הטיול שלנו (טיסות, מלונות, רכבות, רכב או כרטיסים). תוציא מהם את ההזמנות בפורמט שהאפליקציה שלנו יודעת לייבא.",
    "רק מה שכתוב באישורים. לא להמציא שעות או תאריכים.",
    "",
    `הטיול: ${ctx.tripName} (${describeDates(ctx)})`,
    "",
    "האישורים:",
    '"""',
    emailText.trim().slice(0, 30000),
    '"""',
    "",
    `תענה ב${lang}: שורה של סיכום, ואחריה בלוק קוד אחד עם השפה tripdata:`,
    "```tripdata\n" + JSON.stringify(EXAMPLE, null, 2) + "\n```",
    "- kind: flight / hotel / train / car / attraction / other. הזמנה אחת לכל טיסה (גם בטיסה עם עצירת ביניים: כל קטע בנפרד) ולכל מלון.",
    "- title: קצר וברור. בטיסה: מאיפה ← לאן (חץ ←, הכתב מימין לשמאל) ומספר הטיסה. במלון: שם המלון.",
    "- start / end: YYYY-MM-DD HH:MM בשעון המקומי של המקום. טיסה: המראה ונחיתה. מלון: צ'ק-אין וצ'ק-אאוט.",
    "- tz / end_tz: אזור זמן IANA של כל צד (למשל Asia/Tokyo). בטיסה ה-end_tz הוא של יעד הנחיתה.",
    "- address: כתובת המלון, כמו באישור. price: המחיר הכולל כמו שכתוב, עם המטבע.",
    "- cancel_by: YYYY-MM-DD, היום האחרון לבטל בלי תשלום, רק אם כתוב באישור.",
    "- note: מה ששימושי ביום עצמו: טרמינל, כבודה, ארוחת בוקר, שעת איסוף.",
    "- בלי מספרי הזמנה, קודי אישור, מספרי דרכון, שמות נוסעים מלאים או פרטי תשלום.",
    "- JSON תקין, בלי הערות בתוך הבלוק.",
  ].join("\n");
}
