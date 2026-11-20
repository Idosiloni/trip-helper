import { normalizeForCompare } from "../text";

export type DupInfo = { duplicateOf: string | null; repeatInBatch: boolean };

/**
 * Flags items whose title already exists (SPEC 7.3: "כבר קיים: מעיל גשם"),
 * or repeats an earlier item in the same batch. Comparison ignores case,
 * punctuation, spacing and niqqud.
 */
export function findDuplicates(titles: string[], existing: string[]): DupInfo[] {
  const known = new Map<string, string>();
  for (const e of existing) {
    const k = normalizeForCompare(e);
    if (k && !known.has(k)) known.set(k, e);
  }
  const seen = new Set<string>();
  return titles.map((t) => {
    const k = normalizeForCompare(t);
    const info: DupInfo = { duplicateOf: known.get(k) ?? null, repeatInBatch: seen.has(k) };
    seen.add(k);
    return info;
  });
}

const STOP = new Set(["the", "and", "for", "with", "את", "של", "עם", "על", "גם", "או"]);
/** Words that carry meaning: 3+ letters, Hebrew one-letter prefixes (ו/ב/ל/ה/מ/ש) dropped from long words. */
function words(s: string): Set<string> {
  const out = new Set<string>();
  for (let w of normalizeForCompare(s).split(/[^\p{L}\p{N}]+/u)) {
    if (/^[ובלהמש][֐-׿]{4,}$/.test(w)) w = w.slice(1);
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

/**
 * Items that look like one already in the list without being the same title
 * ("לשמור מקומות לשינקנסן ו-Romancecar" vs "לשמור מקומות ברכבת Romancecar").
 * Similar = most of the shorter title's words are in the other, or two shared words and the same due date.
 */
export function findSimilar(items: { title: string; due?: string | null }[], existing: { title: string; due?: string | null }[]): (string | null)[] {
  const ex = existing.map((e) => ({ ...e, w: words(e.title), k: normalizeForCompare(e.title) }));
  return items.map((it) => {
    const w = words(it.title);
    const k = normalizeForCompare(it.title);
    if (w.size < 2) return null;
    let best: { title: string; score: number } | null = null;
    for (const e of ex) {
      if (e.k === k || e.w.size < 2) continue;
      const shared = [...w].filter((x) => e.w.has(x)).length;
      const score = shared / Math.min(w.size, e.w.size);
      const sameDue = Boolean(it.due && e.due && it.due === e.due);
      if (shared >= 2 && (score >= 0.6 || sameDue) && (!best || score > best.score)) best = { title: e.title, score };
    }
    return best?.title ?? null;
  });
}
