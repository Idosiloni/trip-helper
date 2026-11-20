import type { Stop } from "../trip-data/types";

// Small facts read out of what the chat wrote, so they show at a glance
// instead of hiding inside a paragraph of notes.

export type StopTag = { kind: "book" | "closed" | "cash" | "early" | "optional"; label: string };

const BOOK = /להזמין[^.,;]{0,30}מראש|(?:חובה|צריך)\s+להזמין|מזמינים\s+(?:מראש|שולחן)|הזמנה\s+מראש|לשריין|להזמין\s+שולחן|כרטיס\s+עם\s+שעה|book\s+(?:ahead|in advance)|reservation\s+required|timed\s+ticket/i;
const CLOSED = /סגור\s+(?:ב)?(?:ימי\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)|closed\s+on\s+(\w+)/i;
const CASH = /מזומן\s+בלבד|רק\s+מזומן|cash\s+only/i;
const OPTIONAL = /^\s*אופציונלי|\(אופציונלי\)|אם\s+יש\s+כוח|optional\b/i;
const EARLY = /להגיע\s+(?:מוקדם|לפני\s+\d)|מגיעים\s+מוקדם|לפני\s+הקבוצות|early\s+(?:morning|arrival)/i;

/** Tags for one stop, from its note and how-to-get-there text. */
export function stopTags(s: Pick<Stop, "notes" | "transport_note">, placeNote?: string | null): StopTag[] {
  const text = [s.notes, placeNote].filter(Boolean).join(" ");
  if (!text) return [];
  const out: StopTag[] = [];
  if (OPTIONAL.test(s.notes ?? "")) out.push({ kind: "optional", label: "אם יש כוח" });
  if (BOOK.test(text)) out.push({ kind: "book", label: "להזמין מראש" });
  const closed = CLOSED.exec(text);
  if (closed) out.push({ kind: "closed", label: `סגור ב${closed[1] ? `יום ${closed[1]}` : closed[2]}` });
  if (CASH.test(text)) out.push({ kind: "cash", label: "מזומן בלבד" });
  if (EARLY.test(text)) out.push({ kind: "early", label: "להגיע מוקדם" });
  return out;
}

/** Minutes of travel in a "how to get there" line ("מטרו 10 דק׳", "שעה", "1:15", "2 שעות"). */
export function travelMinutes(text: string | null | undefined): number {
  if (!text) return 0;
  const hm = /(\d{1,2}):(\d{2})/.exec(text);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  let m = 0;
  const hours = /(\d+(?:[.,]\d+)?)\s*(?:שעות|שעה|ש׳|ש'|hours?|hrs?|h\b)/i.exec(text);
  if (hours) m += Math.round(parseFloat(hours[1].replace(",", ".")) * 60);
  else if (/(?:^|\s)(?:שעה|כשעה)(?:\s|$|[,.])/.test(text)) m += 60;
  const mins = /(\d+)\s*(?:דקות|דק׳|דק'|דק\b|min)/i.exec(text);
  if (mins) m += Number(mins[1]);
  return m;
}

export type DayLoad = { activity: number; travel: number; level: "light" | "full" | "heavy" };

/** A stop that is itself the journey (a flight, a long train): not part of how busy the day is. */
export const isJourneyStop = (label: string) => /טיסה|טיסת|נחיתה|נמל\s*התעופה|flight|airport|shinkansen|שינקנסן|frecciarossa|romancecar|\bexpress\b|\btrain\s+to\b|nozomi|hikari|kagayaki|thunderbird|רכבת\s+(?:מהירה|לילה|hida|ל)|אוטובוס\s+ל|ferry\s+to|→|←/i.test(label);

/** How full a day is: planned time at stops plus travel between them (journeys themselves left out). */
export function dayLoad(stops: (Pick<Stop, "duration_min" | "transport_note"> & { label?: string })[]): DayLoad {
  stops = stops.filter((s) => !(s.label && isJourneyStop(s.label)));
  const activity = stops.reduce((a, s) => a + (s.duration_min ?? 60), 0);
  const travel = stops.reduce((a, s) => a + travelMinutes(s.transport_note), 0);
  const total = activity + travel;
  return { activity, travel, level: total > 9 * 60 ? "heavy" : total >= 5 * 60 ? "full" : "light" };
}
