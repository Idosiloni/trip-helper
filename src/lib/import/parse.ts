import JSON5 from "json5";
import { straightenQuotes } from "../text";
import { Envelope, IMPORTABLE_KINDS, ITEM_SCHEMAS, KINDS, TITLE_FIELD, type ImportableKind, type ItemOf } from "../tripdata/schemas";

// Lenient parser for answers pasted back from any chat (SPEC 7.3).
// The user pastes the WHOLE answer; we find the data in it:
//   1. a ```tripdata fenced block (preferred), then any other fenced block with JSON,
//   2. otherwise the first balanced {...} or [...] in the text.
// JSON5 tolerates trailing commas, comments and single quotes; smart quotes
// are straightened only as a fallback (they can be legitimate inside values).

export type ParseOk<K extends ImportableKind = ImportableKind> = {
  ok: true;
  kind: K;
  items: ItemOf<K>[];
  /** Items that failed validation and were dropped. */
  invalid: number;
  via: "tripdata" | "code-block" | "inline";
  data: unknown;
};

export type ParseFail = {
  ok: false;
  reason: "empty" | "no_data" | "bad_json" | "unsupported_kind" | "no_items";
  /** For unsupported_kind: what the chat sent. */
  kind?: string;
};

export type ParseResult = ParseOk | ParseFail;

type Candidate = { text: string; via: ParseOk["via"] };

export function fencedBlocks(input: string): Candidate[] {
  const out: Candidate[] = [];
  // Closed blocks, plus a final unclosed block (chat answer cut off or copied partially).
  const re = /(?:```|~~~)[ \t]*([\w-]*)[^\n]*\n([\s\S]*?)(?:```|~~~|$(?![\s\S]))/g;
  for (const m of input.matchAll(re)) {
    const lang = (m[1] ?? "").toLowerCase();
    const body = m[2] ?? "";
    if (!/[[{]/.test(body)) continue;
    out.push({ text: body, via: lang === "tripdata" ? "tripdata" : "code-block" });
  }
  // tripdata first
  return out.sort((a, b) => (a.via === "tripdata" ? -1 : 0) - (b.via === "tripdata" ? -1 : 0));
}

/** First balanced JSON-ish object/array, skipping over string contents. */
function firstBalanced(input: string): string | null {
  const start = input.search(/[[{]/);
  if (start < 0) return null;
  const open = input[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return input.slice(start, i + 1);
  }
  return null;
}

export function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  for (const variant of [text, straightenQuotes(text)]) {
    try {
      return { ok: true, value: JSON5.parse(variant) };
    } catch {
      // A block may hold JSON plus trailing prose; retry on its balanced part.
      const inner = firstBalanced(variant);
      if (inner && inner !== variant) {
        try {
          return { ok: true, value: JSON5.parse(inner) };
        } catch {
          /* next variant */
        }
      }
    }
  }
  return { ok: false };
}

/** Pulls {kind, items} out of the shapes chats actually produce. */
export function toEnvelope(value: unknown, expected?: ImportableKind): { kind: string; items: unknown[] } | null {
  if (Array.isArray(value)) return expected ? { kind: expected, items: value } : null;
  if (!value || typeof value !== "object") return null;
  const env = Envelope.safeParse(value);
  if (env.success) return { kind: env.data.kind, items: env.data.items };
  // { "packing": [...] } or { "tasks": [...] }
  for (const k of KINDS) {
    const v = (value as Record<string, unknown>)[k];
    if (Array.isArray(v)) return { kind: k, items: v };
  }
  // { "items": [...] } without a kind
  const items = (value as Record<string, unknown>).items;
  if (Array.isArray(items) && expected) return { kind: expected, items };
  return null;
}

export function parseAnswer(input: string, expected?: ImportableKind): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: "empty" };

  const candidates = fencedBlocks(text);
  const inline = firstBalanced(text);
  if (inline) candidates.push({ text: inline, via: "inline" });
  if (candidates.length === 0) return { ok: false, reason: "no_data" };

  let sawJson = false;
  for (const c of candidates) {
    const parsed = tryParse(c.text);
    if (!parsed.ok) continue;
    sawJson = true;
    const env = toEnvelope(parsed.value, expected);
    if (!env) continue;
    if (!(IMPORTABLE_KINDS as readonly string[]).includes(env.kind)) {
      return { ok: false, reason: "unsupported_kind", kind: env.kind };
    }
    const kind = env.kind as ImportableKind;
    const schema = ITEM_SCHEMAS[kind];
    const items: unknown[] = [];
    let invalid = 0;
    for (const raw of env.items) {
      const r = schema.safeParse(typeof raw === "string" ? { [TITLE_FIELD[kind]]: raw } : raw);
      if (r.success) items.push(r.data);
      else invalid++;
    }
    if (items.length === 0) return { ok: false, reason: "no_items" };
    return { ok: true, kind, items: items as ItemOf<typeof kind>[], invalid, via: c.via, data: parsed.value } as ParseOk;
  }
  return { ok: false, reason: sawJson ? "no_data" : "bad_json" };
}

/**
 * A plain pasted list (one item per line) for any list (SPEC 7.3 #6).
 * Strips bullets, numbering and checkbox marks; "×3" / "x3" at the end is a quantity.
 */
export function parsePlainList(input: string): { title: string; qty?: number }[] {
  const out: { title: string; qty?: number }[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    let line = rawLine
      .replace(/^\s*(?:[-*•·◦▪–—]|\d+[.)]|\[[ xX✓]?\]|[☐☑✅✔️]+)\s*/u, "")
      .trim();
    if (!line || /^```/.test(line)) continue;
    let qty: number | undefined;
    const m = line.match(/\s*[×xX*]\s*(\d{1,3})\s*$/) ?? line.match(/^(\d{1,3})\s*[×xX]\s+/);
    if (m) {
      qty = Number(m[1]);
      line = line.replace(m[0], "").trim();
    }
    if (line.length > 0) out.push({ title: line.slice(0, 200), ...(qty && qty > 1 ? { qty } : {}) });
  }
  return out.slice(0, 300);
}
