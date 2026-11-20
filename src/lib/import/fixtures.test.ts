import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportableKind } from "../tripdata/schemas";
import { parseAnswer } from "./parse";

const DIR = join(process.cwd(), "fixtures/ai-responses");
type Exp = { expect: ImportableKind; ok: boolean; count?: number; invalid?: number; via?: string; reason?: string };
const expectations = JSON.parse(readFileSync(join(DIR, "expectations.json"), "utf8")) as Record<string, Exp>;

describe("fixtures: pasted chat answers", () => {
  it.each(Object.entries(expectations))("%s", (file, exp) => {
    const result = parseAnswer(readFileSync(join(DIR, file), "utf8"), exp.expect);
    expect(result.ok).toBe(exp.ok);
    if (result.ok) {
      expect(result.kind).toBe(exp.expect);
      expect(result.items).toHaveLength(exp.count!);
      if (exp.invalid !== undefined) expect(result.invalid).toBe(exp.invalid);
      if (exp.via) expect(result.via).toBe(exp.via);
    } else {
      expect(result.reason).toBe(exp.reason);
    }
  });
});
