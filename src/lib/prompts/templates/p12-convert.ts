import type { ImportableKind } from "../../tripdata/schemas";
import { formatInstructions } from "../format";

export const P12_VERSION = 1;

/**
 * Prompt 12: the safety net (SPEC 7.3 #5). Sent to the SAME chat when its
 * answer had no usable block; asks it to re-emit the previous answer in format.
 */
export function buildP12(kind: ImportableKind, answerLanguage: "he" | "en"): string {
  return [
    "התשובה הקודמת שלך לא הייתה בפורמט שאני יכול לייבא.",
    "קח את כל הפריטים מהתשובה הקודמת, בלי להוסיף ובלי להוריד, והחזר אותם רק כבלוק הקוד שמתואר כאן.",
    "",
    formatInstructions(kind, answerLanguage),
  ].join("\n");
}
