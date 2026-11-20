import type { z } from "zod";
import { ITEM_SCHEMAS, type ImportableKind } from "./schemas";

/**
 * Builds the example item for a kind from the `example` metadata on its
 * schema fields, so the prompt's format sample always matches the validator.
 */
export function exampleItem(kind: ImportableKind): Record<string, unknown> {
  const shape = ITEM_SCHEMAS[kind].shape as Record<string, z.ZodType>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(shape)) {
    const meta = field.meta() as { example?: unknown } | undefined;
    if (meta?.example !== undefined) out[key] = meta.example;
  }
  return out;
}

/** The full ```tripdata block shown in a prompt. */
export function exampleBlock(kind: ImportableKind): string {
  // The plan carries its "route logic" beside the days.
  const extra = kind === "itinerary" ? { overview: "מתחילים בטוקיו ליד השדה, עוברים להרים כשעוד לא קר מדי, ומסיימים בקיוטו." } : {};
  const body = JSON.stringify({ v: 1, kind, ...extra, items: [exampleItem(kind)] }, null, 2);
  return "```tripdata\n" + body + "\n```";
}

/** Field names a kind accepts, for the prompt's field list. */
export function fieldNames(kind: ImportableKind): string[] {
  return Object.keys(ITEM_SCHEMAS[kind].shape);
}
