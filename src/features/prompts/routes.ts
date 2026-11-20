import type { PromptId, PromptParams } from "@/lib/prompts/registry";
import type { ImportableKind } from "@/lib/tripdata/schemas";

/** Which kind of answer a trip route expects, if any. */
export function kindForPath(pathname: string): ImportableKind | null {
  if (/\/lists\/packing(\/|$)/.test(pathname)) return "packing";
  if (/\/lists\/tasks(\/|$)/.test(pathname)) return "tasks";
  if (/\/lists\/purchases(\/|$)/.test(pathname)) return "purchases";
  if (/\/lists\/notes(\/|$)/.test(pathname)) return "notes";
  if (/\/places(\/|$)/.test(pathname)) return "places";
  if (/\/plan(\/|$)/.test(pathname) && !/\/plan\/bookings/.test(pathname)) return "itinerary";
  return null;
}

export type PromptEntry = { id: PromptId; params?: PromptParams; key: string };

/** Prompts offered by the "copy prompt" button on each screen (SPEC §4). */
export function promptsForPath(pathname: string, cities: string[]): PromptEntry[] {
  if (/\/(journal|summary)(\/|$)/.test(pathname)) {
    return [
      { id: "p11-summary", params: { summaryStyle: "journal" }, key: "p11" },
      { id: "p11-summary", params: { summaryStyle: "post" }, key: "p11:post" },
    ];
  }
  const kind = kindForPath(pathname);
  if (kind === "packing") return [{ id: "p04-packing", key: "p04" }];
  if (kind === "tasks") return [{ id: "p03-tasks", key: "p03" }];
  if (kind === "purchases") return [{ id: "p05-gifts", key: "p05" }];
  if (kind === "notes") return [{ id: "p06-notes", key: "p06" }];
  if (kind === "places") {
    return cities.length ? cities.map((city) => ({ id: "p02-places", params: { city }, key: `p02:${city}` })) : [{ id: "p02-places", key: "p02" }];
  }
  if (kind === "itinerary") return [{ id: "p01-itinerary", key: "p01" }, { id: "p07-review", key: "p07" }];
  return [
    { id: "p03-tasks", key: "p03" },
    { id: "p04-packing", key: "p04" },
    { id: "p01-itinerary", key: "p01" },
    { id: "p06-notes", key: "p06" },
  ];
}

export function importHrefFor(base: string, pathname: string, promptId?: PromptId, kind?: ImportableKind | null): string {
  const k = kind ?? kindForPath(pathname);
  const params = new URLSearchParams();
  if (k) params.set("kind", k);
  if (promptId) params.set("prompt", promptId);
  const q = params.toString();
  return `${base}/import${q ? `?${q}` : ""}`;
}
