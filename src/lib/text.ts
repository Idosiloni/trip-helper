/**
 * Normalizes text for duplicate detection (SPEC §18): case, width, Hebrew
 * niqqud, punctuation and whitespace differences don't count.
 */
export function normalizeForCompare(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud and cantillation
    .replace(/[̀-ͯ]/g, "") // Latin diacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Replaces "smart" quotes that chat UIs insert, so JSON parses.
 * Hebrew gershayim (U+05F4, as in צה״ל) is deliberately left alone: it appears
 * inside legitimate string values and must not become a JSON quote.
 */
export function straightenQuotes(s: string): string {
  return s.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛′]/g, "'");
}
