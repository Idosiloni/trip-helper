"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { Stamp } from "@/components/ui/Stamp";
import { showToast } from "@/components/ui/Toast";
import { keyAfter } from "@/lib/position";
import { useToday } from "@/lib/use-today";
import { copyText } from "../prompts/clipboard";
import { insertRow, patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Task } from "../trip-data/types";
import { canToggle, dueDay, live, toDueAt, travelerLabel } from "./helpers";
import { parseTaskQuickAdd } from "@/lib/quick-add";
import { ListTabs } from "./ListTabs";
import { SnoozeButton } from "./SnoozeButton";
import { TaskSheet } from "./TaskSheet";

type Filter = "open" | "mine" | "date" | "all" | "overdue" | "unassigned";

function TaskRow({ task, today, onOpen }: { task: Task; today: string; onOpen: () => void }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const day = dueDay(task.due_at);
  const overdue = !task.done && day !== null && day < today;
  const who = travelerLabel(snap, task.assignee_traveler_id);
  const allowed = canToggle(snap, task.assignee_traveler_id);

  async function toggle() {
    try {
      await patchRow(store, "tasks", task.id, { done: !task.done });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <li className="flex min-h-14 items-center gap-1 border-b border-hair">
      <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
        <input
          type="checkbox"
          checked={task.done}
          disabled={!allowed}
          onChange={toggle}
          aria-label={task.title}
          className="peer col-start-1 row-start-1 size-[26px] cursor-pointer appearance-none rounded-full border-[2.5px] border-c-tasks bg-surface checked:border-c-tasks checked:bg-c-tasks disabled:cursor-not-allowed disabled:opacity-40"
        />
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none col-start-1 row-start-1 hidden size-4 text-surface peer-checked:block" fill="none" stroke="currentColor" strokeWidth={4}>
          <path d="M4 12.5l5 5L20 7" />
        </svg>
      </label>
      <button type="button" onClick={onOpen} className="flex min-h-14 flex-1 flex-col items-start justify-center py-1.5 text-start">
        <span className={`text-[17px] ${task.done ? "text-ink-3 line-through" : ""}`}>{task.title}</span>
        {who || task.source === "ai" ? (
          <span className="text-xs text-ink-2">
            {who ?? ""}
            {who && task.source === "ai" ? " · " : ""}
            {task.source === "ai" ? t("fromChat") : ""}
          </span>
        ) : null}
      </button>
      {day && !task.done ? (
        overdue ? (
          <SnoozeButton task={task} today={today} label={t("overdue")} />
        ) : (
          <span className="shrink-0 px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-ink-2">{t("dueShort", { date: `${Number(day.slice(8))}.${Number(day.slice(5, 7))}` })}</span>
        )
      ) : null}
    </li>
  );
}

export function TasksScreen() {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const today = useToday() ?? "";
  const params = useSearchParams();
  const initial = (params.get("filter") as Filter | null) ?? "open";
  const [filter, setFilter] = useState<Filter>(initial);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const trip = snap.trip!;

  const tasks = live(snap.tasks);
  const groups = live(snap.taskGroups);
  const shown = useMemo(() => {
    const me = snap.me.travelerId;
    return tasks.filter((x) => {
      switch (filter) {
        case "open":
          return !x.done;
        case "mine":
          return !x.done && !!me && x.assignee_traveler_id === me;
        case "overdue":
          return !x.done && !!dueDay(x.due_at) && dueDay(x.due_at)! < today;
        case "unassigned":
          return !x.done && !x.assignee_traveler_id;
        default:
          return true;
      }
    });
  }, [tasks, filter, snap.me.travelerId, today]);

  const doneCount = tasks.filter((x) => x.done).length;

  async function add(e: FormEvent) {
    e.preventDefault();
    const parsed = parseTaskQuickAdd(newTitle, today || new Date().toISOString().slice(0, 10), live(snap.travelers));
    if (!parsed.title) return;
    setNewTitle("");
    try {
      await insertRow(store, "tasks", {
        title: parsed.title,
        due_at: parsed.due ? toDueAt(parsed.due, null) : null,
        due_all_day: true,
        assignee_traveler_id: parsed.assignee,
        position: keyAfter(tasks.at(-1)?.position),
      });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  async function addGroup(e: FormEvent) {
    e.preventDefault();
    const title = newGroup.trim();
    if (!title) return;
    setNewGroup("");
    await insertRow(store, "taskGroups", { title, position: keyAfter(groups.at(-1)?.position) }).catch(() => showToast({ message: tc("errorGeneric") }));
  }

  async function copyAsText() {
    const lines = [`${trip.name}: ${t("title")}`, ""];
    for (const x of tasks.filter((x) => !x.done)) {
      const who = travelerLabel(snap, x.assignee_traveler_id);
      const day = dueDay(x.due_at);
      lines.push(`☐ ${x.title}${who ? ` (${who})` : ""}${day ? ` · ${t("dueShort", { date: `${Number(day.slice(8))}.${Number(day.slice(5, 7))}` })}` : ""}`);
    }
    if (await copyText(lines.join("\n"))) showToast({ message: t("copiedText") });
  }

  // By date: overdue / this week / later / no date, instead of one long list.
  function byDateSections(sorted: Task[]) {
    const weekEnd = today ? new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10) : "";
    const bucket = (x: Task) => {
      const d = dueDay(x.due_at);
      if (!d) return "none";
      if (!x.done && today && d < today) return "overdue";
      return weekEnd && d <= weekEnd ? "week" : "later";
    };
    return (["overdue", "week", "later", "none"] as const)
      .map((k) => ({ key: k, title: t(`dateSections.${k}`), items: sorted.filter((x) => bucket(x) === k) }))
      .filter((sec) => sec.items.length > 0);
  }
  const preview = newTitle.trim() ? parseTaskQuickAdd(newTitle, today || new Date().toISOString().slice(0, 10), live(snap.travelers)) : null;

  const sections: { key: string; title: string; items: Task[] }[] =
    filter === "date"
      ? byDateSections([...shown].sort((a, b) => ((a.due_at ?? "9999") < (b.due_at ?? "9999") ? -1 : 1)))
      : [
          ...groups.map((g) => ({ key: g.id, title: g.title, items: shown.filter((x) => x.group_id === g.id) })),
          { key: "none", title: groups.length ? t("noGroup") : "", items: shown.filter((x) => !x.group_id || !groups.some((g) => g.id === x.group_id)) },
        ].filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col">
      <ListTabs tripId={trip.id} />
      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="display print-offset text-[3.5rem] leading-[0.8] tabular-nums">
            {doneCount}/{tasks.length}
          </span>
          <span className="font-bold">{t("doneLabel")}</span>
        </p>
        {tasks.length ? (
          <button type="button" onClick={copyAsText} className="flex min-h-11 items-center gap-1.5 text-sm font-bold underline underline-offset-4">
            <Icon name="copy" size={16} />
            {t("copyText")}
          </button>
        ) : null}
      </div>
      <Segmented<Filter>
        label={t("show")}
        value={filter === "overdue" || filter === "unassigned" ? filter : filter}
        onChange={setFilter}
        options={[
          { value: "open", label: t("filters.open") },
          { value: "mine", label: t("filters.mine") },
          { value: "date", label: t("filters.date") },
          { value: "all", label: t("filters.all") },
          ...(filter === "overdue" || filter === "unassigned" ? [{ value: filter, label: t(`filters.${filter}`) }] : []),
        ]}
      />

      {tasks.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="lists" title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-ink-2">{t("noneInFilter")}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {sections.map((s) => (
            <section key={s.key}>
              {s.title ? <h3 className="mt-2 border-s-4 border-c-tasks bg-surface px-2 py-1 text-sm font-extrabold">{s.title}</h3> : null}
              <ul>
                {s.items.map((x) => (
                  <TaskRow key={x.id} task={x} today={today} onOpen={() => setOpenTask(x)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canEdit ? (
        <div className="mt-6 flex flex-col gap-3">
          <form onSubmit={add} className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("addPlaceholder")}
              aria-label={t("addPlaceholder")}
              maxLength={200}
              className="min-h-12 flex-1 border-2 border-ink bg-surface px-3 text-base placeholder:text-ink-3"
            />
            <button type="submit" aria-label={tc("add")} className="grid size-12 place-items-center bg-ink text-on-ink">
              <Icon name="plus" strokeWidth={3} />
            </button>
          </form>
          {preview && (preview.due || preview.assignee) ? (
            <p className="-mt-1 text-sm font-bold text-c-tasks">
              {[preview.due ? t("dueShort", { date: `${Number(preview.due.slice(8))}.${Number(preview.due.slice(5, 7))}` }) : null, preview.assignee ? travelerLabel(snap, preview.assignee) : null].filter(Boolean).join(" · ")}
            </p>
          ) : (
            <p className="-mt-1 text-xs text-ink-2">{t("quickAddHint")}</p>
          )}
          <form onSubmit={addGroup} className="flex gap-2">
            <input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder={t("addGroupPlaceholder")}
              aria-label={t("addGroupPlaceholder")}
              maxLength={60}
              className="min-h-11 flex-1 border-2 border-dashed border-ink bg-transparent px-3 text-sm placeholder:text-ink-3"
            />
            <button type="submit" className="min-h-11 px-3 text-sm font-bold underline underline-offset-4">
              {t("addGroup")}
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-6">
          <Stamp tone="muted">{t("viewerNote")}</Stamp>
        </p>
      )}

      <TaskSheet task={openTask ? (snap.tasks.find((x) => x.id === openTask.id) ?? null) : null} onClose={() => setOpenTask(null)} />
    </div>
  );
}
