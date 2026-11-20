import { describeDates, describeRoute, describeTravelers, type PromptContext } from "../context";

export const P11_VERSION = 1;

export type SummaryStyle = "journal" | "post";

const STARS = (n: number | null) => (n ? ` (${n}/5)` : "");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Prompt 11: a trip summary for the journal or a post. Free-text answer (pasted as a journal entry). */
export function buildP11(ctx: PromptContext, style: SummaryStyle = "journal"): string {
  const lang = ctx.profile.answerLanguage === "he" ? "עברית" : "אנגלית";
  const m = ctx.memories ?? { places: [], journal: [] };
  const lines = [
    style === "post"
      ? "תכתוב לנו פוסט קצר וחם על הטיול המשפחתי שחזרנו ממנו, שאפשר לשתף עם חברים ומשפחה."
      : "תכתוב לנו סיכום של הטיול המשפחתי שחזרנו ממנו, לשמירה ביומן הטיול.",
    "",
    `טיול: ${ctx.tripName}`,
    `יעד: ${describeRoute(ctx)}`,
    `תאריכים: ${describeDates(ctx)}`,
    `מטיילים: ${describeTravelers(ctx)}`,
  ];
  const days = (ctx.plan?.days ?? []).filter((d) => d.stops.length || d.title);
  if (days.length) {
    lines.push("", "המסלול:");
    for (const d of days.slice(0, 40)) {
      const what = d.stops.map((s) => s.label).join(", ");
      lines.push(`- ${d.date}${d.city ? ` ${d.city}` : ""}${d.title ? ` · ${d.title}` : ""}${what ? `: ${what}` : ""}`);
    }
  }
  if (m.places.length) {
    lines.push("", "מקומות שביקרנו:");
    for (const p of m.places.slice(0, 60)) lines.push(`- ${p.name}${p.city ? `, ${p.city}` : ""}${STARS(p.rating)}${p.note ? `: ${clip(p.note, 200)}` : ""}`);
  }
  if (m.journal.length) {
    lines.push("", "מה כתבנו ביומן:");
    for (const j of m.journal.slice(0, 40)) lines.push(`- ${j.date ? `${j.date}: ` : ""}${clip(j.body, 400)}${STARS(j.rating)}`);
  }
  lines.push(
    "",
    style === "post"
      ? "באורך של 150 עד 250 מילים. בלי האשטגים ובלי שמות מלאים."
      : "מבנה: פתיחה של 2-3 משפטים, רגעים בולטים לפי הסדר, מה הכי אהבנו, ומה נעשה אחרת בפעם הבאה. עד 400 מילים.",
    `כתוב ב${lang}, בטקסט רגיל. בלי בלוק קוד.`,
  );
  return lines.join("\n");
}
