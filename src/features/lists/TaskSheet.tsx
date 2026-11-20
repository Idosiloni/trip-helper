"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Task } from "../trip-data/types";
import { dueDay, live, toDueAt } from "./helpers";

type Draft = { title: string; notes: string; link: string; day: string; time: string; assignee: string; group: string; phase: Task["phase"] };

const toDraft = (t: Task): Draft => ({
  title: t.title,
  notes: t.notes ?? "",
  link: t.link ?? "",
  day: dueDay(t.due_at) ?? "",
  time: t.due_at && !t.due_all_day ? new Date(t.due_at).toTimeString().slice(0, 5) : "",
  assignee: t.assignee_traveler_id ?? "",
  group: t.group_id ?? "",
  phase: t.phase,
});

/** Only the fields that changed (SPEC §11: no overwrites). */
function diff(task: Task, d: Draft) {
  const patch: Partial<Task> = {};
  const title = d.title.trim();
  if (title && title !== task.title) patch.title = title;
  if ((d.notes.trim() || null) !== task.notes) patch.notes = d.notes.trim() || null;
  if ((d.link.trim() || null) !== task.link) patch.link = d.link.trim() || null;
  const dueAt = d.day ? toDueAt(d.day, d.time || null) : null;
  const allDay = !d.time;
  if (dueAt !== task.due_at && !(dueAt && task.due_at && new Date(dueAt).getTime() === new Date(task.due_at).getTime())) patch.due_at = dueAt;
  if (allDay !== task.due_all_day) patch.due_all_day = allDay;
  if ((d.assignee || null) !== task.assignee_traveler_id) patch.assignee_traveler_id = d.assignee || null;
  if ((d.group || null) !== task.group_id) patch.group_id = d.group || null;
  if (d.phase !== task.phase) patch.phase = d.phase;
  return patch;
}

function Editor({ task, onClose }: { task: Task; onClose: () => void }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [d, setD] = useState<Draft>(() => toDraft(task));
  const [busy, setBusy] = useState(false);
  const linkOk = !d.link.trim() || /^https?:\/\/\S+$/i.test(d.link.trim());
  const by = snap.members.find((m) => m.user_id === task.created_by)?.profile?.display_name;

  async function save() {
    const patch = diff(task, d);
    if (Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    try {
      await patchRow(store, "tasks", task.id, patch);
      onClose();
    } catch {
      showToast({ message: tc("errorGeneric") });
      setBusy(false);
    }
  }

  async function remove() {
    onClose();
    try {
      const undo = await softDelete(store, "tasks", task.id);
      showToast({ message: t("deleted", { title: task.title }), actionLabel: tc("undo"), onAction: () => void undo() });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <fieldset disabled={!canEdit} className="flex flex-col gap-4">
      <TextField label={t("titleLabel")} value={d.title} maxLength={200} onChange={(e) => setD({ ...d, title: e.target.value })} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">{t("notes")}</span>
        <textarea rows={3} maxLength={4000} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} className="border-2 border-ink bg-surface p-3 text-base" />
      </label>
      <TextField label={t("link")} type="url" dir="ltr" inputMode="url" placeholder="https://" value={d.link} onChange={(e) => setD({ ...d, link: e.target.value })} error={linkOk ? null : t("badLink")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={t("due")} type="date" value={d.day} onChange={(e) => setD({ ...d, day: e.target.value })} />
        <TextField label={t("time")} type="time" value={d.time} disabled={!d.day} hint={t("timeHint")} onChange={(e) => setD({ ...d, time: e.target.value })} />
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select
            label={t("assignee")}
            value={d.assignee}
            onChange={(e) => setD({ ...d, assignee: e.target.value })}
            options={[{ value: "", label: t("nobody") }, ...live(snap.travelers).map((x) => ({ value: x.id, label: x.label }))]}
          />
        </div>
        {snap.me.travelerId && d.assignee !== snap.me.travelerId ? (
          <Button variant="secondary" onClick={() => setD({ ...d, assignee: snap.me.travelerId! })}>
            {t("takeIt")}
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label={t("group")} value={d.group} onChange={(e) => setD({ ...d, group: e.target.value })} options={[{ value: "", label: t("noGroup") }, ...live(snap.taskGroups).map((g) => ({ value: g.id, label: g.title }))]} />
        <Select
          label={t("phase")}
          value={d.phase}
          onChange={(e) => setD({ ...d, phase: e.target.value as Task["phase"] })}
          options={(["before", "during", "after"] as const).map((p) => ({ value: p, label: t(`phases.${p}`) }))}
        />
      </div>
      <p className="text-sm text-ink-2">
        {t("createdBy", { name: by ?? "?" })}
        {task.source === "ai" ? ` · ${t("fromChat")}` : ""}
      </p>
      {canEdit ? (
        <>
          <Button size="lg" block loading={busy} disabled={!d.title.trim() || !linkOk} onClick={save}>
            {tc("save")}
          </Button>
          <Button variant="danger" block icon={<Icon name="trash" size={18} />} onClick={remove}>
            {tc("delete")}
          </Button>
        </>
      ) : null}
    </fieldset>
  );
}

export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  return (
    <Sheet open={task !== null} onClose={onClose} title={t("details")} closeLabel={tc("close")}>
      {task ? <Editor key={task.id} task={task} onClose={onClose} /> : null}
    </Sheet>
  );
}
