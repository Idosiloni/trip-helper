import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

// Ordering keys (fractional indexing, SPEC §16). Stored with COLLATE "C" in
// Postgres, so plain string comparison here matches the database order.

export function keyAfter(last: string | null | undefined): string {
  return generateKeyBetween(last ?? null, null);
}

export function keyBetween(before: string | null | undefined, after: string | null | undefined): string {
  return generateKeyBetween(before ?? null, after ?? null);
}

export function keysAfter(last: string | null | undefined, count: number): string[] {
  return generateNKeysBetween(last ?? null, null, count);
}

/** Highest key in a list (or null), for appending. */
export function lastKey(items: ReadonlyArray<{ position: string }>): string | null {
  let max: string | null = null;
  for (const it of items) if (max === null || it.position > max) max = it.position;
  return max;
}

export function byPosition<T extends { position: string }>(a: T, b: T): number {
  return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
}
