"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { keysAfter, lastKey } from "@/lib/position";
import { NOTE_KINDS, type NoteKind } from "@/lib/tripdata/schemas";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { TripNote } from "../trip-data/types";
import { live } from "./helpers";
import { ListTabs } from "./ListTabs";

function NoteSheet({ note, open, onClose, defaultKind }: { note: TripNote | null; open: boolean; onClose: () => void; defaultKind: NoteKind }) {
  const t = useTranslations("notes");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [kind, setKind] = useState<NoteKind>(note?.kind ?? defaultKind);
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (note) {
        const patch: Partial<Pick<TripNote, "kind" | "title" | "body">> = {};
        if (kind !== note.kind) patch.kind = kind;
        if (title.trim() !== note.title) patch.title = title.trim();
        if ((body.trim() || null) !== note.body) patch.body = body.trim() || null;
        if (Object.keys(patch).length) await patchRow(store, "notes", note.id, patch);
      } else {
        const [position] = keysAfter(lastKey(live(snap.notes)), 1);
        await insertRow(store, "notes", { kind, title: title.trim(), body: body.trim() || null, position });
      }
      onClose();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!note) return;
    onClose();
    const undo = await softDelete(store, "notes", note.id).catch(() => null);
    if (undo) showToast({ message: t("deleted"), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <Sheet open={open} onClose={onClose} title={note ? t("edit") : t("add")} closeLabel={tc("close")}>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Select label={t("kindLabel")} value={kind} onChange={(e) => setKind(e.target.value as NoteKind)} options={NOTE_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
        <TextField label={t("titleLabel")} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="note-body" className="text-sm font-bold">
            {t("bodyLabel")}
          </label>
          <textarea id="note-body" rows={6} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} className="w-full border-2 border-ink bg-surface px-3 py-2 text-lg text-ink focus:border-focus focus:outline-none" />
        </div>
        {canEdit ? (
          <>
            <Button size="lg" block loading={busy} disabled={!title.trim()} onClick={save}>
              {tc("save")}
            </Button>
            {note ? (
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

export function NotesScreen() {
  const t = useTranslations("notes");
  const snap = useTripData();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState<TripNote | "new" | null>(null);
  const [filter, setFilter] = useState<NoteKind | "all">("all");
  const notes = live(snap.notes);
  const present = NOTE_KINDS.filter((k) => notes.some((n) => n.kind === k));
  const shown = filter === "all" ? notes : notes.filter((n) => n.kind === filter);
  const groups = NOTE_KINDS.map((k) => ({ kind: k, items: shown.filter((n) => n.kind === k) })).filter((g) => g.items.length);

  return (
    <div className="flex flex-col">
      <ListTabs tripId={snap.trip!.id} />
      {notes.length === 0 ? (
        <EmptyState icon="lists" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          {present.length > 1 ? (
            <div role="group" aria-label={t("kindLabel")} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {(["all", ...present] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={filter === k}
                  onClick={() => setFilter(k)}
                  className={`min-h-10 shrink-0 border-2 border-ink px-3 text-sm font-bold ${filter === k ? "bg-ink text-on-ink" : "bg-surface"}`}
                >
                  {k === "all" ? t("all") : t(`kinds.${k}`)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <section key={g.kind} aria-labelledby={`notes-${g.kind}`}>
                <h2 id={`notes-${g.kind}`} className="display mb-2 text-3xl text-c-notes">
                  {t(`kinds.${g.kind}`)}
                </h2>
                <ul className="flex flex-col gap-3">
                  {g.items.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => setOpen(n)} className="flex w-full flex-col gap-1 border-2 border-s-[6px] border-ink border-s-c-notes bg-surface p-4 text-start shadow-[3px_3px_0_0_var(--trip-tint)] active:bg-surface-2">
                        <span className="text-lg font-extrabold">{n.title}</span>
                        {n.body ? <span className="whitespace-pre-line text-[17px] leading-snug">{n.body}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
      {canEdit ? (
        <Button variant="secondary" className="mt-4" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => setOpen("new")}>
          {t("add")}
        </Button>
      ) : null}
      <NoteSheet
        key={open === "new" ? "new" : (open?.id ?? "closed")}
        note={open && open !== "new" ? open : null}
        open={open !== null}
        onClose={() => setOpen(null)}
        defaultKind={filter === "all" ? "general" : filter}
      />
    </div>
  );
}
