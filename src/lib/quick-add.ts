import { normalizeForCompare } from "./text";
import { parsePlainList } from "./import/parse";
import type { PackingCategory } from "./tripdata/schemas";

// Typing shortcuts for the "add" fields of tasks and packing.

const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * "להזמין מלון עד 20.12 @אמא" → { title: "להזמין מלון", due: "2026-12-20", assignee: <id> }.
 * Dates: "20.12", "20/12", "20.12.27", "עד 20.12", "היום", "מחר". A day/month without a year is the
 * next one on or after today. "@name" matches the start of a traveler's label.
 */
export function parseTaskQuickAdd(input: string, today: string, travelers: { id: string; label: string }[]): { title: string; due: string | null; assignee: string | null } {
  let text = ` ${input.trim()} `;
  let due: string | null = null;
  let assignee: string | null = null;

  const m = text.match(/\s(?:עד\s+|ב-?)?(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?=\s)/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(today.slice(0, 4));
      if (!m[3] && `${y}-${pad(mo)}-${pad(d)}` < today) y += 1;
      due = `${y}-${pad(mo)}-${pad(d)}`;
      text = text.replace(m[0], " ");
    }
  } else {
    const rel = text.match(/\s(?:עד\s+)?(היום|מחר)(?=\s)/);
    if (rel) {
      due = rel[1] === "היום" ? today : addDays(today, 1);
      text = text.replace(rel[0], " ");
    }
  }

  const at = text.match(/\s@(\S+)/);
  if (at) {
    const key = normalizeForCompare(at[1]);
    const hit = travelers.find((t) => normalizeForCompare(t.label).startsWith(key));
    if (hit) {
      assignee = hit.id;
      text = text.replace(at[0], " ");
    }
  }
  return { title: text.replace(/\s+/g, " ").trim(), due, assignee };
}

const CATEGORY_WORDS: [PackingCategory, RegExp][] = [
  ["documents", /דרכו[נן]|ביטוח|ויזה|כרטיס טיסה|רישיון|מסמכ|passport/i],
  ["electronics", /מטען|כבל|מתאם|סוללה|אוזני|מצלמ|טאבלט|לפטופ|מחשב|charger|adapter/i],
  ["meds", /תרופ|אקמול|נורופן|אדוויל|פלסטר|עזרה ראשונה|כדור|משחה|ויטמינ/i],
  ["kids", /חיתול|מוצץ|בקבוק תינוק|עגלה|צעצוע|מגבונ|טיטול|מנשא/i],
  ["toiletries", /מברשת|משחת שיניים|שמפו|סבון|קרם|דאודורנט|מסרק|גילוח|תחבושות|קוסמטיק|מגבת/i],
  ["clothing", /חולצ|מכנס|גרב|תחתונ|מעיל|נעל|כפכפ|כובע|פיג'?מ|בגד|סוודר|סווטשירט|ג'?קט|שמלה|חצאית|צעיף|כפפות|גופי/i],
];

export function guessPackingCategory(title: string): PackingCategory {
  return CATEGORY_WORDS.find(([, re]) => re.test(title))?.[0] ?? "other";
}

/** "גרביים ×5, מטען, דרכונים" or several lines → items with qty and a guessed category. */
export function parsePackingQuickAdd(input: string): { title: string; qty: number; category: PackingCategory }[] {
  const lines = input.includes("\n") ? input : input.replace(/[,،]\s*/g, "\n");
  return parsePlainList(lines).map((x) => ({ title: x.title.slice(0, 120), qty: x.qty ?? 1, category: guessPackingCategory(x.title) }));
}
