import type { ImportableKind } from "../tripdata/schemas";
import type { PromptContext } from "./context";
import { redact } from "./redact";
import { buildP01, P01_VERSION } from "./templates/p01-itinerary";
import { buildP02, P02_VERSION } from "./templates/p02-places";
import { buildP03, P03_VERSION } from "./templates/p03-tasks";
import { buildP04, P04_VERSION } from "./templates/p04-packing";
import { buildP05, P05_VERSION } from "./templates/p05-gifts";
import { buildP06, P06_VERSION } from "./templates/p06-notes";
import { buildP07, P07_VERSION } from "./templates/p07-review";
import { buildP08, P08_VERSION, type HelpNow } from "./templates/p08-help-now";
import { buildP09, P09_VERSION } from "./templates/p09-change-plan";
import { buildP10, P10_VERSION, type PlaceQuestion } from "./templates/p10-place";
import { buildP11, P11_VERSION, type SummaryStyle } from "./templates/p11-summary";
import { buildP12, P12_VERSION } from "./templates/p12-convert";
import { buildP13, P13_VERSION } from "./templates/p13-whole-plan";
import { buildP14, P14_VERSION } from "./templates/p14-bookings";

export type PromptId =
  | "p01-itinerary"
  | "p02-places"
  | "p03-tasks"
  | "p04-packing"
  | "p05-gifts"
  | "p06-notes"
  | "p07-review"
  | "p08-help-now"
  | "p09-change-plan"
  | "p10-place"
  | "p11-summary"
  | "p12-convert"
  | "p13-whole-plan"
  | "p14-bookings";

export type PromptDef = {
  id: PromptId;
  version: number;
  /** What a pasted answer contains; null = free text (no import). */
  kind: ImportableKind | null;
  /** Key under messages.prompts.* */
  titleKey: "p01" | "p02" | "p03" | "p04" | "p05" | "p06" | "p07" | "p08" | "p09" | "p10" | "p11" | "p12" | "p13" | "p14";
};

export const PROMPTS: Record<PromptId, PromptDef> = {
  "p01-itinerary": { id: "p01-itinerary", version: P01_VERSION, kind: "itinerary", titleKey: "p01" },
  "p02-places": { id: "p02-places", version: P02_VERSION, kind: "places", titleKey: "p02" },
  "p03-tasks": { id: "p03-tasks", version: P03_VERSION, kind: "tasks", titleKey: "p03" },
  "p04-packing": { id: "p04-packing", version: P04_VERSION, kind: "packing", titleKey: "p04" },
  "p05-gifts": { id: "p05-gifts", version: P05_VERSION, kind: "purchases", titleKey: "p05" },
  "p06-notes": { id: "p06-notes", version: P06_VERSION, kind: "notes", titleKey: "p06" },
  "p07-review": { id: "p07-review", version: P07_VERSION, kind: "itinerary", titleKey: "p07" },
  "p08-help-now": { id: "p08-help-now", version: P08_VERSION, kind: "places", titleKey: "p08" },
  "p09-change-plan": { id: "p09-change-plan", version: P09_VERSION, kind: "itinerary", titleKey: "p09" },
  "p10-place": { id: "p10-place", version: P10_VERSION, kind: null, titleKey: "p10" },
  "p11-summary": { id: "p11-summary", version: P11_VERSION, kind: null, titleKey: "p11" },
  "p12-convert": { id: "p12-convert", version: P12_VERSION, kind: "tasks", titleKey: "p12" },
  "p13-whole-plan": { id: "p13-whole-plan", version: P13_VERSION, kind: null, titleKey: "p13" },
  "p14-bookings": { id: "p14-bookings", version: P14_VERSION, kind: null, titleKey: "p14" },
};

/** Parameters some prompts need. */
export type PromptParams = {
  /** The user's extra request ("בלי מוזיאונים"). */
  extra?: string;
  /** p12: which format to convert to. */
  convertKind?: ImportableKind;
  /** p02: city (and optional neighborhood). */
  city?: string;
  area?: string;
  /** p01: plan only these dates. */
  onlyDates?: string[];
  /** p10: the place being asked about. */
  place?: PlaceQuestion;
  /** p08: what we're looking for, where and when. */
  help?: HelpNow;
  /** p09: the day to change and why. */
  date?: string;
  reason?: string;
  /** p11: a journal summary or a post to share. */
  summaryStyle?: SummaryStyle;
  /** p13: the family's existing plan, pasted as is. p14: confirmation emails. */
  planText?: string;
};

/** Builds the final, redacted prompt text. */
export function buildPrompt(id: PromptId, ctx: PromptContext, opts: PromptParams = {}): string {
  let body: string;
  switch (id) {
    case "p01-itinerary":
      body = buildP01(ctx, opts.onlyDates);
      break;
    case "p02-places":
      body = buildP02(ctx, opts.city ?? "", opts.area);
      break;
    case "p03-tasks":
      body = buildP03(ctx);
      break;
    case "p04-packing":
      body = buildP04(ctx);
      break;
    case "p05-gifts":
      body = buildP05(ctx);
      break;
    case "p06-notes":
      body = buildP06(ctx);
      break;
    case "p07-review":
      body = buildP07(ctx);
      break;
    case "p08-help-now":
      body = opts.help ? buildP08(ctx, opts.help) : "";
      break;
    case "p09-change-plan":
      body = opts.date ? buildP09(ctx, opts.date, opts.reason ?? "") : "";
      break;
    case "p10-place":
      body = opts.place ? buildP10(ctx, opts.place) : "";
      break;
    case "p11-summary":
      body = buildP11(ctx, opts.summaryStyle);
      break;
    case "p12-convert":
      body = buildP12(opts.convertKind ?? "tasks", ctx.profile.answerLanguage);
      break;
    case "p13-whole-plan":
      body = buildP13(ctx, opts.planText ?? "");
      break;
    case "p14-bookings":
      body = buildP14(ctx, opts.planText ?? "");
      break;
  }
  const extra = opts.extra?.trim();
  if (extra && id !== "p12-convert" && id !== "p13-whole-plan" && id !== "p14-bookings") body += `\n\nבקשה נוספת: ${extra}`;
  return redact(body);
}

// Chat apps to open after copying. TODO(verify): which accept a prefilled
// prompt in the URL, and their length limits. When unsure we open the app
// with no text; the prompt is already on the clipboard either way.
export type ChatApp = { id: "chatgpt" | "claude" | "gemini"; label: string; url: (q: string) => string; prefill: boolean };

export const CHAT_APPS: readonly ChatApp[] = [
  { id: "chatgpt", label: "ChatGPT", url: (q: string) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`, prefill: true },
  { id: "claude", label: "Claude", url: (q: string) => `https://claude.ai/new?q=${encodeURIComponent(q)}`, prefill: true },
  { id: "gemini", label: "Gemini", url: () => "https://gemini.google.com/app", prefill: false },
];

/** Prefilled links get long; past this, open the app empty and rely on the clipboard. */
export const MAX_PREFILL_URL = 6000;

export function chatUrl(app: ChatApp, prompt: string): string {
  if (!app.prefill) return app.url(prompt);
  const full = app.url(prompt);
  return full.length <= MAX_PREFILL_URL ? full : app.url("").replace(/[?&]q=$/, "");
}
