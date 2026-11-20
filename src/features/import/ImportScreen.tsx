"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Stamp } from "@/components/ui/Stamp";
import { showToast } from "@/components/ui/Toast";
import { findDuplicates, findSimilar } from "@/lib/import/dedupe";
import { parseAnswer, parsePlainList, type ParseFail } from "@/lib/import/parse";
import { parseTripProfile } from "@/lib/trip-profile";
import { patchProfile } from "../setup/api";
import { parseWholePlan, type WholePart } from "@/lib/import/whole";
import { keysAfter, lastKey } from "@/lib/position";
import { buildPrompt, PROMPTS, type PromptId } from "@/lib/prompts/registry";
import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { normalizeForCompare } from "@/lib/text";
import {
  categoryKey,
  IMPORTABLE_KINDS,
  itemTitle,
  noteKindKey,
  placeCategoryKey,
  type ImportableKind,
  type ItineraryItemT,
  type PackingItemT,
  type NoteItemT,
  type PlaceItemT,
  type PurchaseItemT,
  type TaskItemT,
} from "@/lib/tripdata/schemas";
import { useToday } from "@/lib/use-today";
import { live, toDueAt } from "../lists/helpers";
import { copyText } from "../prompts/clipboard";
import { promptContext } from "../prompts/context-from-store";
import { insertRow, patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { itineraryPayload, lodgingConflicts, planItinerary, type PlannedDay } from "./plan-import";
import { LastPasteBar } from "./LastPasteBar";
import { lastImport, undoImport } from "./undo";
import { makeTravelerResolver } from "./resolve";
import { BookingsStep, ProfileStep } from "./WholeSteps";

type AnyItem = TaskItemT | PackingItemT | PlaceItemT | PurchaseItemT | NoteItemT;
type Row = { key: number; title: string; include: boolean; duplicateOf: string | null; similarTo: string | null; repeat: boolean; traveler: string | null; forRaw?: string; unmatched: boolean; detail: string; item: AnyItem };

const CHATS = ["ChatGPT", "Claude", "Gemini", "other"] as const;
const DEFAULT_PROMPT: Record<ImportableKind, PromptId> = {
  tasks: "p03-tasks",
  packing: "p04-packing",
  places: "p02-places",
  itinerary: "p01-itinerary",
  purchases: "p05-gifts",
  notes: "p06-notes",
};
const DEST: Record<ImportableKind, string> = {
  tasks: "lists/tasks",
  packing: "lists/packing",
  places: "places/confirm",
  itinerary: "plan",
  purchases: "lists/purchases",
  notes: "lists/notes",
};

function FailPanel({ fail, kind, onPlain }: { fail: ParseFail; kind: ImportableKind; onPlain: () => void }) {
  const t = useTranslations("import");
  const snap = useTripData();
  const today = useToday() ?? "";
  const [copied, setCopied] = useState(false);
  const p12 = buildPrompt("p12-convert", promptContext(snap, kind, today), { convertKind: kind });
  return (
    <div role="alert" className="flex flex-col gap-3 border-2 border-dashed border-ink bg-surface p-4">
      <p className="text-lg font-extrabold">{t(`fail.${fail.reason}`, { kind: fail.kind ?? "" })}</p>
      {fail.reason !== "empty" && fail.reason !== "unsupported_kind" ? (
        <>
          <p className="text-ink-2">{t("convertExplain")}</p>
          <Button onClick={async () => setCopied(await copyText(p12))} icon={<Icon name={copied ? "check" : "copy"} />}>
            {copied ? t("convertCopied") : t("copyConvert")}
          </Button>
          {kind !== "itinerary" ? (
            <button type="button" onClick={onPlain} className="min-h-11 self-start font-bold underline underline-offset-4">
              {t("asPlainList")}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Day-by-day preview; for prompt 7 each day shows "now" vs "proposed" and is replaced only if chosen. */
function ItineraryPreview({ days, include, replace, setInclude, setReplace }: { days: PlannedDay[]; include: Set<string>; replace: Set<string>; setInclude: (s: Set<string>) => void; setReplace: (s: Set<string>) => void }) {
  const t = useTranslations("import");
  const toggle = (set: Set<string>, k: string, on: boolean) => {
    const n = new Set(set);
    if (on) n.add(k);
    else n.delete(k);
    return n;
  };
  return (
    <div className="flex flex-col gap-4">
      {days.map((d) => {
        const k = d.dayId ?? "unscheduled";
        const on = include.has(k);
        const rep = d.dayId !== null && replace.has(d.dayId);
        return (
          <section key={k} className={`border-2 border-ink ${on ? "bg-surface" : "bg-paper opacity-60"}`}>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 border-b-2 border-ink px-3">
              <input type="checkbox" checked={on} onChange={(e) => setInclude(toggle(include, k, e.target.checked))} className="size-6 accent-[var(--ink)]" />
              <span className="flex-1 font-extrabold">{d.dayId ? d.label : t("notInDates")}</span>
              <span className="text-sm text-ink-2">{t("stopsN", { n: d.stops.length })}</span>
            </label>
            <div className={`grid gap-3 p-3 ${d.current.length ? "grid-cols-2" : ""}`}>
              {d.current.length ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-extrabold text-ink-2">{t("now")}</span>
                  {d.current.map((c, i) => (
                    <span key={i} className={`text-sm ${rep ? "text-ink-3 line-through" : ""}`}>
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                {d.current.length ? <span className="text-xs font-extrabold text-ink-2">{rep ? t("proposed") : t("appended")}</span> : null}
                {d.stops.map((s) => (
                  <span key={s.key} className="text-sm">
                    {s.label}
                    {s.newPlaceKey ? <span className="text-xs font-bold text-trip-ink"> · {t("newPlace")}</span> : null}
                  </span>
                ))}
              </div>
            </div>
            {d.dayId && d.current.length ? (
              <label className="flex min-h-11 cursor-pointer items-center gap-2 border-t border-hair px-3 text-sm font-bold">
                <input type="checkbox" checked={rep} disabled={!on} onChange={(e) => setReplace(toggle(replace, d.dayId!, e.target.checked))} className="size-5 accent-[var(--ink)]" />
                {t("replaceDay", { n: d.current.length })}
              </label>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function LodgingWarning({ conflicts }: { conflicts: ReturnType<typeof lodgingConflicts> }) {
  const t = useTranslations("import");
  if (!conflicts.length) return null;
  return (
    <div role="alert" className="flex flex-col gap-1.5 border-2 border-ink bg-trip-tint p-3">
      <p className="font-extrabold">{t("lodgingMismatch")}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {conflicts.map((c, i) => (
          <li key={i}>{t("lodgingMismatchRow", { date: c.date.slice(8, 10) + "." + c.date.slice(5, 7), pasted: c.pasted, saved: c.saved })}</li>
        ))}
      </ul>
      <p className="text-xs">{t("lodgingMismatchHint")}</p>
    </div>
  );
}

export function ImportScreen() {
  const t = useTranslations("import");
  const tp = useTranslations("packing");
  const tpl = useTranslations("places");
  const tn = useTranslations("notes");
  const tc = useTranslations("common");
  const params = useSearchParams();
  const router = useRouter();
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const today = useToday() ?? "";
  const trip = snap.trip!;
  const base = `/trips/${trip.id}`;

  const promptId = (params.get("prompt") as PromptId | null) ?? null;
  const initialKind = (params.get("kind") as ImportableKind | null) ?? (promptId ? (PROMPTS[promptId].kind ?? "tasks") : "tasks");
  const [kind, setKind] = useState<ImportableKind>(initialKind);
  const [raw, setRaw] = useState("");
  const [plain, setPlain] = useState(false);
  const [chat, setChat] = useState<(typeof CHATS)[number]>("ChatGPT");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [plan, setPlan] = useState<ReturnType<typeof planItinerary> | null>(null);
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [replace, setReplace] = useState<Set<string>>(new Set());
  const [invalid, setInvalid] = useState(0);
  const [fail, setFail] = useState<ParseFail | null>(null);
  const [parsedData, setParsedData] = useState<unknown>(null);
  const [groupMode, setGroupMode] = useState<"chat" | "none" | string>("chat");
  const [bagId, setBagId] = useState("");
  const [busy, setBusy] = useState(false);
  // A whole plan (prompt 13): several parts, imported one after another.
  const [queue, setQueue] = useState<WholePart[] | null>(null);
  const [step, setStep] = useState(0);
  const current = queue?.[step] ?? null;
  const special = current && (current.kind === "profile" || current.kind === "bookings") ? current : null;

  const travelers = live(snap.travelers);
  const hasFor = kind === "tasks" || kind === "packing";

  function existingTitles(k: ImportableKind) {
    const snap = store.getSnapshot();
    if (k === "tasks") return live(snap.tasks).map((x) => x.title);
    if (k === "packing") return live(snap.packing).map((x) => x.title);
    if (k === "purchases") return live(snap.purchases).map((x) => x.title);
    if (k === "notes") return live(snap.notes).map((x) => x.title);
    return live(snap.places).map((x) => x.name);
  }

  function buildRows(k: ImportableKind, items: AnyItem[]): Row[] {
    const resolveTraveler = makeTravelerResolver(store.getSnapshot(), today);
    const titles = items.map((it) => itemTitle(k, it));
    const dups = findDuplicates(titles, existingTitles(k));
    // Close but not the same ("לשמור מקומות לשינקנסן…" twice in other words): flagged, the user decides.
    const snapNow = store.getSnapshot();
    const similar =
      k === "tasks"
        ? findSimilar(
            items.map((it) => ({ title: itemTitle(k, it), due: (it as TaskItemT).due ?? null })),
            live(snapNow.tasks).map((x) => ({ title: x.title, due: x.due_at?.slice(0, 10) ?? null })),
          )
        : findSimilar(titles.map((title) => ({ title })), existingTitles(k).map((title) => ({ title })));
    return items.map((it, i): Row => {
      const forValue = "for" in it ? it.for : undefined;
      const traveler = hasForKind(k) ? resolveTraveler(forValue) : null;
      let detail = "";
      let title = titles[i];
      if (k === "tasks") {
        const x = it as TaskItemT;
        detail = [x.due ? t("due", { date: x.due }) : null, x.group, x.note].filter(Boolean).join(" · ");
      } else if (k === "packing") {
        const x = it as PackingItemT;
        detail = [tp(`categories.${categoryKey(x.category)}`), x.note].filter(Boolean).join(" · ");
        if (x.qty && x.qty > 1) title = `${title} ×${x.qty}`;
      } else if (k === "purchases") {
        const x = it as PurchaseItemT;
        detail = [x.for, x.budget, x.where, x.note].filter(Boolean).join(" · ");
      } else if (k === "notes") {
        const x = it as NoteItemT;
        detail = [tn(`kinds.${noteKindKey(x.kind)}`), x.body].filter(Boolean).join(" · ");
      } else {
        const x = it as PlaceItemT;
        detail = [tpl(`categories.${placeCategoryKey(x.category)}`), x.area ?? x.city, x.priority === "must" ? tpl("must") : null, x.why].filter(Boolean).join(" · ");
      }
      return { key: i, title, include: !dups[i].duplicateOf && !dups[i].repeatInBatch, duplicateOf: dups[i].duplicateOf, similarTo: dups[i].duplicateOf ? null : similar[i], repeat: dups[i].repeatInBatch, traveler: traveler ?? null, forRaw: forValue, unmatched: traveler === undefined, detail, item: it };
    });
  }

  function showItinerary(items: ItineraryItemT[]) {
    const p = planItinerary(store.getSnapshot(), items);
    setPlan(p);
    setInclude(new Set(p.days.map((d) => d.dayId ?? "unscheduled")));
    // A day that comes back whole (two stops or more) replaces what the day had: pasting a
    // plan again shouldn't double every day. One or two extra stops are added instead.
    // Prompts 7 and 9 always propose replacements.
    const always = promptId === "p07-review" || promptId === "p09-change-plan";
    setReplace(new Set(p.days.filter((d) => d.dayId && d.current.length && (always || d.stops.length >= 2)).map((d) => d.dayId!)));
  }

  function openPart(part: WholePart) {
    setRows(null);
    setPlan(null);
    setInvalid(0);
    if (part.kind === "profile" || part.kind === "bookings") return;
    setKind(part.kind);
    setParsedData(part.data);
    if (part.kind === "itinerary") showItinerary(part.items as ItineraryItemT[]);
    else setRows(buildRows(part.kind, part.items as AnyItem[]));
  }

  function advance() {
    if (queue && step < queue.length - 1) {
      setBusy(false);
      setStep(step + 1);
      // Built from the store's current data (it was just reloaded), not this render's.
      openPart(queue[step + 1]);
      window.scrollTo({ top: 0 });
      return;
    }
    showToast({ message: promptId === "p14-bookings" ? t("bookingsDone") : t("wholeDone") });
    router.push(promptId === "p14-bookings" ? `${base}/plan/bookings` : `${base}/plan`);
  }

  function parse() {
    setFail(null);
    if (!plain) {
      const parts = parseWholePlan(raw);
      if (parts.length > 1 || ((promptId === "p13-whole-plan" || promptId === "p14-bookings") && parts.length)) {
        setQueue(parts);
        setStep(0);
        openPart(parts[0]);
        return;
      }
    }
    if (plain && kind !== "itinerary") {
      const list = parsePlainList(raw);
      if (!list.length) return setFail({ ok: false, reason: "empty" });
      setInvalid(0);
      setParsedData(null);
      const items = list.map((l) => (kind === "packing" ? { title: l.title, qty: l.qty } : kind === "places" ? { name: l.title } : { title: l.title }));
      setRows(buildRows(kind, items as AnyItem[]));
      return;
    }
    const r = parseAnswer(raw, kind);
    if (!r.ok) {
      setRows(null);
      setPlan(null);
      return setFail(r);
    }
    setKind(r.kind);
    setInvalid(r.invalid);
    setParsedData(r.data);
    if (r.kind === "itinerary") showItinerary(r.items as ItineraryItemT[]);
    else setRows(buildRows(r.kind, r.items as AnyItem[]));
  }

  async function pasteFromClipboard() {
    try {
      setRaw(await navigator.clipboard.readText());
    } catch {
      showToast({ message: t("clipboardBlocked") });
    }
  }

  /** Days the plan put in a city get that city, unless someone already set one. */
  async function fillDayCities(days: PlannedDay[]) {
    for (const d of days) {
      if (!d.dayId || !include.has(d.dayId)) continue;
      const day = snap.days.find((x) => x.id === d.dayId);
      if (!day) continue;
      // The day's headline from the answer ("מקדשים ויער במבוק"), if the day doesn't have one.
      // Its intent in a sentence and its plan B: kept as they were unless this import replaces the day.
      const first = <K extends "day_title" | "day_summary" | "plan_b">(k: K) => d.stops.map((s) => s.item[k]).find(Boolean);
      const title = first("day_title");
      const summary = first("day_summary");
      const planB = first("plan_b");
      const redo = replace.has(day.id);
      const patch: { title?: string; notes?: string; plan_b?: string } = {};
      if (title && (!day.title || redo)) patch.title = title.slice(0, 60);
      if (summary && (!day.notes || redo)) patch.notes = summary.slice(0, 2000);
      if (planB && (!day.plan_b || redo)) patch.plan_b = planB.slice(0, 1000);
      if (Object.keys(patch).length) await patchRow(store, "days", day.id, patch).catch(() => undefined);
      if (day.city) continue;
      const counts = new Map<string, number>();
      for (const s of d.stops) if (s.item.city) counts.set(s.item.city, (counts.get(s.item.city) ?? 0) + 1);
      const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (city) await patchRow(store, "days", day.id, { city: city.slice(0, 60) }).catch(() => undefined);
    }
  }

  async function undoAndReload(id: string) {
    try {
      const moved = await undoImport(id);
      await store.load();
      showToast({ message: t("pasteUndone", { n: moved }) });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  async function commit() {
    setBusy(true);
    try {
      let items: unknown;
      let n = 0;
      if (kind === "itinerary" && plan) {
        const built = itineraryPayload(snap, plan.days, plan.newPlaces, { include, replace });
        items = built.payload;
        n = built.count;
      } else if (rows) {
        const chosen = rows.filter((r) => r.include);
        n = chosen.length;
        if (kind === "tasks") {
          const groupIdFor = new Map<string, string>();
          if (groupMode === "chat") {
            const known = new Map(live(snap.taskGroups).map((g) => [normalizeForCompare(g.title), g.id]));
            let last = lastKey(live(snap.taskGroups));
            for (const r of chosen) {
              const name = (r.item as TaskItemT).group?.trim();
              if (!name) continue;
              const k = normalizeForCompare(name);
              if (!known.has(k)) {
                const [pos] = keysAfter(last, 1);
                last = pos;
                const g = await insertRow(store, "taskGroups", { title: name.slice(0, 60), position: pos });
                known.set(k, g.id);
              }
              groupIdFor.set(name, known.get(k)!);
            }
          }
          const positions = keysAfter(lastKey(live(snap.tasks)), chosen.length);
          items = chosen.map((r, i) => {
            const x = r.item as TaskItemT;
            return {
              title: x.title,
              notes: x.note ?? null,
              link: x.link ?? null,
              due_at: x.due ? toDueAt(x.due, null) : null,
              due_all_day: true,
              phase: x.phase ?? "before",
              assignee_traveler_id: r.traveler,
              group_id: groupMode === "chat" ? (x.group ? (groupIdFor.get(x.group.trim()) ?? null) : null) : groupMode === "none" ? null : groupMode,
              position: positions[i],
            };
          });
        } else if (kind === "packing") {
          const positions = keysAfter(lastKey(live(snap.packing)), chosen.length);
          items = chosen.map((r, i) => {
            const x = r.item as PackingItemT;
            return { title: x.title, qty: x.qty ?? 1, category: categoryKey(x.category), notes: x.note ?? null, traveler_id: r.traveler, bag_id: bagId || null, position: positions[i] };
          });
        } else if (kind === "purchases") {
          const positions = keysAfter(lastKey(live(snap.purchases)), chosen.length);
          items = chosen.map((r, i) => {
            const x = r.item as PurchaseItemT;
            return { title: x.title, for_whom: x.for ?? null, budget: x.budget ?? null, where_text: x.where ?? null, notes: x.note ?? null, link: x.link ?? null, position: positions[i] };
          });
        } else if (kind === "notes") {
          const positions = keysAfter(lastKey(live(snap.notes)), chosen.length);
          items = chosen.map((r, i) => {
            const x = r.item as NoteItemT;
            return { kind: noteKindKey(x.kind), title: x.title, body: x.body ?? null, position: positions[i] };
          });
        } else {
          const positions = keysAfter(lastKey(snap.places), chosen.length);
          items = chosen.map((r, i) => {
            const x = r.item as PlaceItemT;
            return { name: x.name, category: placeCategoryKey(x.category), city: x.city ?? null, area: x.area ?? null, notes: x.why ?? null, priority: x.priority ?? "maybe", hours_text: x.hours ?? null, price_level: x.price ?? null, position: positions[i] };
          });
        }
      }
      if (!n) {
        setBusy(false);
        return;
      }
      const usedPrompt = plain ? null : (promptId ?? DEFAULT_PROMPT[kind]);
      const { data: count, error } = await supabase().rpc("commit_import", {
        p_trip_id: trip.id,
        p_kind: kind,
        p_items: items as Json,
        p_raw_text: raw.slice(0, 200000),
        p_prompt_id: usedPrompt ?? "paste",
        p_prompt_version: usedPrompt ? PROMPTS[usedPrompt].version : 0,
        p_source: plain ? "paste" : "ai",
        p_source_label: plain || chat === "other" ? undefined : chat,
        p_parsed: (parsedData ?? undefined) as Json | undefined,
      });
      if (error) throw error;
      if (kind === "itinerary" && plan) {
        await fillDayCities(plan.days);
        // "Why the route goes this way": the chat writes it once, beside the days.
        const overview = (parsedData as { overview?: unknown } | null)?.overview;
        if (typeof overview === "string" && overview.trim() && (replace.size > 0 || !parseTripProfile(trip.profile).overview))
          await patchProfile(trip.id, { overview: overview.trim().slice(0, 2000) }).catch(() => undefined);
      }
      await store.load();
      const made = await lastImport(trip.id).catch(() => null);
      showToast({
        message: t("added", { n: count ?? n }),
        duration: 10_000,
        ...(made ? { actionLabel: t("undoPaste"), onAction: () => void undoAndReload(made.id) } : {}),
      });
      if (queue) return advance();
      router.push(`${base}/${DEST[kind]}`);
    } catch (e) {
      console.error(e);
      showToast({ message: tc("errorGeneric") });
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader title={t("title")} backHref={`${base}/today`} backLabel={tc("back")} />
        <p>{t("viewerCant")}</p>
      </div>
    );
  }

  const backHref = promptId === "p14-bookings" ? `${base}/plan/bookings` : `${base}/${kind === "places" ? "places" : DEST[kind]}`;
  const included = rows ? rows.filter((r) => r.include).length : plan ? itineraryPayload(snap, plan.days, plan.newPlaces, { include, replace }).count : 0;
  const reset = () => {
    setRows(null);
    setPlan(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <SubHeader title={queue ? (promptId === "p14-bookings" ? t("bookingsTitle") : t("wholeTitle")) : t("title")} backHref={backHref} backLabel={tc("back")} />

      {queue ? (
        <div className="flex flex-col gap-2">
          <ol aria-label={t("wholeSteps")} className="flex flex-wrap gap-1.5">
            {queue.map((p, i) => (
              <li key={p.kind} aria-current={i === step ? "step" : undefined} className={`border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${i === step ? "bg-ink text-on-ink" : i < step ? "bg-surface-2 text-ink-3 line-through" : "bg-surface"}`}>
                {t(`wholeParts.${p.kind}`)}
              </li>
            ))}
          </ol>
          <p className="text-sm font-bold text-ink-2">{t("wholeStepOf", { n: step + 1, total: queue.length })}</p>
        </div>
      ) : null}

      {special ? (
        special.kind === "profile" ? (
          <ProfileStep key={`p${step}`} profile={special.profile} onDone={advance} onSkip={advance} footer={(b, n, run) => <QueueFooter busy={b} n={n} run={run} onSkip={advance} />} />
        ) : (
          <BookingsStep key={`b${step}`} items={special.items} onDone={advance} onSkip={advance} footer={(b, n, run) => <QueueFooter busy={b} n={n} run={run} onSkip={advance} />} />
        )
      ) : !rows && !plan ? (
        <>
          {!queue ? <LastPasteBar tripId={trip.id} onUndo={undoAndReload} /> : null}
          {!queue && promptId !== "p13-whole-plan" && promptId !== "p14-bookings" ? (
            <Link href={`${base}/import/plan`} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-bold underline underline-offset-4">
              <Icon name="paste" size={16} />
              {t("haveWholePlan")}
            </Link>
          ) : null}
          <Select label={t("into")} value={kind} onChange={(e) => setKind(e.target.value as ImportableKind)} options={IMPORTABLE_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="answer" className="text-sm font-bold">
                {plain ? t("plainLabel") : t("answerLabel")}
              </label>
              <button type="button" onClick={pasteFromClipboard} className="flex min-h-11 items-center gap-1.5 text-sm font-bold underline underline-offset-4">
                <Icon name="paste" size={16} />
                {t("fromClipboard")}
              </button>
            </div>
            <textarea id="answer" value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} dir="auto" placeholder={plain ? t("plainPlaceholder") : t("answerPlaceholder")} className="w-full border-2 border-ink bg-surface p-3 text-sm" />
            {kind !== "itinerary" ? (
              <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} className="size-5 accent-[var(--ink)]" />
                {t("plainToggle")}
              </label>
            ) : null}
          </div>
          {!plain ? <Select label={t("whichChat")} value={chat} onChange={(e) => setChat(e.target.value as (typeof CHATS)[number])} options={CHATS.map((c) => ({ value: c, label: c === "other" ? t("otherChat") : c }))} /> : null}
          {fail ? (
            <FailPanel
              fail={fail}
              kind={kind}
              onPlain={() => {
                setPlain(true);
                setFail(null);
              }}
            />
          ) : null}
          <Button size="lg" block disabled={!raw.trim()} onClick={parse}>
            {t("parse")}
          </Button>
        </>
      ) : (
        <>
          <p className="flex items-baseline gap-2">
            <span className="display print-offset text-[3.5rem] leading-[0.8] tabular-nums">{included}</span>
            <span className="font-bold">{rows ? t("selected", { total: rows.length }) : t("toAdd")}</span>
          </p>
          {invalid ? <p className="text-sm text-ink-2">{t("invalidDropped", { n: invalid })}</p> : null}

          {plan ? (
            <>
              {plan.newPlaces.length ? <p className="text-sm text-ink-2">{t("newPlacesNote", { n: plan.newPlaces.length })}</p> : null}
              <LodgingWarning conflicts={lodgingConflicts(snap, plan.days.filter((d) => include.has(d.dayId ?? "unscheduled")))} />
              <ItineraryPreview days={plan.days} include={include} replace={replace} setInclude={setInclude} setReplace={setReplace} />
            </>
          ) : rows ? (
            <>
              {kind === "tasks" ? (
                <Select label={t("groupInto")} value={groupMode} onChange={(e) => setGroupMode(e.target.value)} options={[{ value: "chat", label: t("groupsFromChat") }, { value: "none", label: t("noGroup") }, ...live(snap.taskGroups).map((g) => ({ value: g.id, label: g.title }))]} />
              ) : kind === "packing" ? (
                <Select label={t("bagInto")} value={bagId} onChange={(e) => setBagId(e.target.value)} options={[{ value: "", label: t("noBag") }, ...live(snap.bags).map((b) => ({ value: b.id, label: b.label }))]} />
              ) : kind === "places" && !queue ? (
                <p className="text-sm text-ink-2">{t("placesThenPins")}</p>
              ) : null}
              {rows.some((r) => r.similarTo && r.include) ? (
                <button
                  type="button"
                  onClick={() => setRows(rows.map((x) => (x.similarTo ? { ...x, include: false } : x)))}
                  className="flex min-h-11 items-center gap-2 self-start border-2 border-ink bg-surface px-3 text-sm font-extrabold"
                >
                  {t("skipSimilar", { n: rows.filter((r) => r.similarTo && r.include).length })}
                </button>
              ) : null}
              <ul className="flex flex-col border-t-2 border-ink">
                {rows.map((r) => (
                  <li key={r.key} className="flex flex-col gap-1 border-b border-hair py-2">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={r.include} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, include: e.target.checked } : x)))} className="mt-1 size-6 shrink-0 accent-[var(--ink)]" />
                      <span className="flex flex-1 flex-col">
                        <span className={`text-[17px] font-bold ${r.include ? "" : "text-ink-3 line-through"}`}>{r.title}</span>
                        {r.detail ? <span className="text-sm text-ink-2">{r.detail}</span> : null}
                      </span>
                      {r.duplicateOf ? (
                        <Stamp tone="muted" tilt={2}>
                          {t("exists", { title: r.duplicateOf })}
                        </Stamp>
                      ) : r.repeat ? (
                        <Stamp tone="muted" tilt={2}>
                          {t("repeat")}
                        </Stamp>
                      ) : r.similarTo ? (
                        <span className="max-w-[45%] shrink-0 text-xs font-bold text-trip-ink">{t("similarTo", { title: r.similarTo })}</span>
                      ) : null}
                    </label>
                    {hasFor && travelers.length ? (
                      <div className="flex items-center gap-2 ps-9">
                        <span className="text-xs font-bold text-ink-2">{kind === "tasks" ? t("assignee") : t("forWhom")}</span>
                        <select aria-label={`${r.title}: ${kind === "tasks" ? t("assignee") : t("forWhom")}`} value={r.traveler ?? ""} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, traveler: e.target.value || null, unmatched: false } : x)))} className="min-h-9 border-2 border-ink bg-surface px-2 text-sm">
                          <option value="">{kind === "tasks" ? t("nobody") : t("shared")}</option>
                          {travelers.map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.label}
                            </option>
                          ))}
                        </select>
                        {r.unmatched && r.forRaw ? <span className="text-xs text-trip-ink">{t("unmatched", { name: r.forRaw })}</span> : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <div className="flex gap-3">
            {queue ? (
              <Button variant="secondary" className="flex-1" onClick={advance} disabled={busy}>
                {t("skip")}
              </Button>
            ) : (
              <Button variant="secondary" className="flex-1" onClick={reset} disabled={busy}>
                {tc("back")}
              </Button>
            )}
            <Button size="lg" className="flex-[2]" loading={busy} disabled={included === 0} onClick={commit}>
              {t("addN", { n: included })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function QueueFooter({ busy, n, run, onSkip }: { busy: boolean; n: number; run: () => void; onSkip: () => void }): ReactNode {
  const t = useTranslations("import");
  return (
    <div className="flex gap-3">
      <Button variant="secondary" className="flex-1" onClick={onSkip} disabled={busy}>
        {t("skip")}
      </Button>
      <Button size="lg" className="flex-[2]" loading={busy} disabled={n === 0} onClick={run}>
        {t("addN", { n })}
      </Button>
    </div>
  );
}

function hasForKind(k: ImportableKind) {
  return k === "tasks" || k === "packing";
}
