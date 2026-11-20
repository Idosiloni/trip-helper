"use client";

import { useTranslations } from "next-intl";
import { showToast } from "@/components/ui/Toast";
import { patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripStore } from "../trip-data/TripDataProvider";
import type { Task } from "../trip-data/types";

/** The day after `today` (YYYY-MM-DD), in plain calendar terms. */
export function nextDay(today: string): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * An overdue task's red date chip, as a button: one tap moves it to tomorrow
 * (same time of day), with undo. No edit screen (feedback 2026-11-20).
 */
export function SnoozeButton({ task, today, label }: { task: Task; today: string; label: string }) {
  const t = useTranslations("tasks");
  const tc = useTranslations("common");
  const store = useTripStore();
  const canEdit = useCanEdit();
  const chip = "shrink-0 bg-trip px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-[#fffcf6]";
  if (!canEdit || !task.due_at) return <span className={chip}>{label}</span>;

  async function snooze() {
    const before = task.due_at;
    const old = new Date(before!);
    const [y, m, d] = nextDay(today).split("-").map(Number);
    const due = new Date(y, m - 1, d, old.getHours(), old.getMinutes()).toISOString();
    try {
      await patchRow(store, "tasks", task.id, { due_at: due });
      showToast({
        message: t("snoozed", { date: `${d}.${m}` }),
        actionLabel: tc("undo"),
        onAction: () => void patchRow(store, "tasks", task.id, { due_at: before }).catch(() => undefined),
      });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <button type="button" onClick={() => void snooze()} aria-label={t("snoozeLabel", { title: task.title })} className={`${chip} flex min-h-9 items-center gap-1`}>
      {label}
      <span aria-hidden="true" className="text-[11px] font-bold opacity-90">
        {t("toTomorrow")}
      </span>
    </button>
  );
}
