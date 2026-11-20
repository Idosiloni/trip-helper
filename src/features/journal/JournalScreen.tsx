"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { showToast } from "@/components/ui/Toast";
import { formatShortDate } from "@/lib/dates";
import { keysAfter, lastKey } from "@/lib/position";
import { useToday } from "@/lib/use-today";
import { live } from "../lists/helpers";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { JournalEntry, TripSnapshot } from "../trip-data/types";

/** Who may change an entry: its author, or an editor (same rule as the database guard). */
export function useCanEditEntry() {
  const snap = useTripData();
  const canEdit = useCanEdit();
  return (e: JournalEntry | null) => !e || canEdit || e.created_by === snap.me.userId;
}

export function dayIdFor(snap: TripSnapshot, date: string | null): string | null {
  return date ? (snap.days.find((d) => d.date === date)?.id ?? null) : null;
}

/** Add or edit a journal entry. `initial` prefills a new one (day, place, pasted text). */
export function JournalSheet({
  entry,
  open,
  onClose,
  initial,
}: {
  entry: JournalEntry | null;
  open: boolean;
  onClose: () => void;
  initial?: { dayId?: string | null; placeId?: string | null; body?: string };
}) {
  const t = useTranslations("journal");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const mayEdit = useCanEditEntry()(entry);
  const [body, setBody] = useState(entry?.body ?? initial?.body ?? "");
  const [dayId, setDayId] = useState(entry?.day_id ?? initial?.dayId ?? "");
  const [placeId, setPlaceId] = useState(entry?.place_id ?? initial?.placeId ?? "");
  const [rating, setRating] = useState<number | null>(entry?.rating ?? null);
  const [busy, setBusy] = useState(false);
  // Visited places first: those are the ones people write about.
  const places = live(snap.places).sort((a, b) => Number(b.status === "visited") - Number(a.status === "visited"));

  async function save() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      const values = { body: text, day_id: dayId || null, place_id: placeId || null, rating };
      if (entry) {
        const patch: Partial<typeof values> = {};
        if (text !== entry.body) patch.body = text;
        if (values.day_id !== entry.day_id) patch.day_id = values.day_id;
        if (values.place_id !== entry.place_id) patch.place_id = values.place_id;
        if (rating !== entry.rating) patch.rating = rating;
        if (Object.keys(patch).length) await patchRow(store, "journal", entry.id, patch);
      } else {
        const [position] = keysAfter(lastKey(live(snap.journal)), 1);
        await insertRow(store, "journal", { ...values, position, created_by: snap.me.userId });
        showToast({ message: t("saved") });
      }
      onClose();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!entry) return;
    onClose();
    const undo = await softDelete(store, "journal", entry.id).catch(() => null);
    if (undo) showToast({ message: t("deleted"), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <Sheet open={open} onClose={onClose} title={entry ? t("edit") : t("add")} closeLabel={tc("close")}>
      <fieldset disabled={!mayEdit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="journal-body" className="text-sm font-bold">
            {t("bodyLabel")}
          </label>
          <textarea
            id="journal-body"
            rows={7}
            maxLength={8000}
            value={body}
            placeholder={t("bodyPlaceholder")}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border-2 border-ink bg-surface px-3 py-2 text-lg text-ink focus:border-focus focus:outline-none"
          />
        </div>
        {snap.days.length ? (
          <Select
            label={t("dayLabel")}
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            options={[{ value: "", label: t("noDay") }, ...snap.days.map((d, i) => ({ value: d.id, label: t("dayOption", { n: i + 1, date: formatShortDate(d.date) }) + (d.city ? ` · ${d.city}` : "") }))]}
          />
        ) : null}
        {places.length ? (
          <Select
            label={t("placeLabel")}
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            options={[{ value: "", label: t("noPlace") }, ...places.map((p) => ({ value: p.id, label: p.name }))]}
          />
        ) : null}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-bold">{t("ratingLabel")}</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={t("stars", { n })}
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? null : n)}
                className={cn("grid size-11 place-items-center border-2 border-ink text-lg font-extrabold", (rating ?? 0) >= n ? "bg-trip text-[#fffcf6]" : "bg-surface")}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        {mayEdit ? (
          <>
            <Button size="lg" block loading={busy} disabled={!body.trim()} onClick={save}>
              {tc("save")}
            </Button>
            {entry ? (
              <Button variant="danger" block icon={<Icon name="trash" size={18} />} onClick={remove}>
                {tc("delete")}
              </Button>
            ) : null}
          </>
        ) : null}
      </fieldset>
    </Sheet>
  );
}

/** One entry as a card: text, and what it's about. */
export function JournalCard({ entry, onOpen }: { entry: JournalEntry; onOpen: () => void }) {
  const t = useTranslations("journal");
  const snap = useTripData();
  const place = entry.place_id ? snap.places.find((p) => p.id === entry.place_id) : null;
  const author = snap.members.find((m) => m.user_id === entry.created_by)?.profile?.display_name;
  const meta = [place?.name, entry.rating ? t("stars", { n: entry.rating }) : null, author].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1 border-2 border-ink bg-surface p-4 text-start active:bg-surface-2">
      <span className="line-clamp-6 whitespace-pre-line text-[17px] leading-snug">{entry.body}</span>
      {meta ? <span className="text-sm font-bold text-ink-2">{meta}</span> : null}
    </button>
  );
}

export function JournalScreen() {
  const t = useTranslations("journal");
  const tc = useTranslations("common");
  const snap = useTripData();
  const openPrompt = useOpenPrompt();
  const today = useToday();
  const [open, setOpen] = useState<JournalEntry | "new" | null>(null);
  const base = `/trips/${snap.trip!.id}`;
  const entries = live(snap.journal);
  const dayIndex = new Map(snap.days.map((d, i) => [d.id, i]));
  // By trip day; entries without a day go last.
  const groups: { key: string; title: string; items: JournalEntry[] }[] = [];
  for (const d of snap.days) {
    const items = entries.filter((e) => e.day_id === d.id);
    if (items.length) groups.push({ key: d.id, title: t("dayOption", { n: (dayIndex.get(d.id) ?? 0) + 1, date: formatShortDate(d.date) }) + (d.city ? ` · ${d.city}` : ""), items });
  }
  const loose = entries.filter((e) => !e.day_id || !dayIndex.has(e.day_id));
  if (loose.length) groups.push({ key: "none", title: t("noDayGroup"), items: loose });

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("title")} backHref={`${base}/today`} backLabel={tc("back")} />
      <div className="flex gap-2">
        <Button className="flex-1" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => setOpen("new")}>
          {t("add")}
        </Button>
        <Button variant="secondary" className="flex-1" icon={<Icon name="copy" size={18} />} onClick={() => openPrompt("p11-summary")}>
          {t("summaryPrompt")}
        </Button>
      </div>
      {entries.length === 0 ? (
        <EmptyState icon="edit" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-3">
            <h2 className="border-b-2 border-ink pb-1 text-lg font-extrabold">{g.title}</h2>
            <ul className="flex flex-col gap-3">
              {g.items.map((e) => (
                <li key={e.id}>
                  <JournalCard entry={e} onOpen={() => setOpen(e)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <JournalSheet
        key={open === "new" ? "new" : (open?.id ?? "closed")}
        entry={open && open !== "new" ? open : null}
        open={open !== null}
        onClose={() => setOpen(null)}
        initial={{ dayId: dayIdFor(snap, today) }}
      />
    </div>
  );
}
