"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { showToast } from "@/components/ui/Toast";
import { canToggle, dueDay, live, travelerLabel } from "../lists/helpers";
import { SnoozeButton } from "../lists/SnoozeButton";
import { patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Task } from "../trip-data/types";

const SHOWN = 6;

/**
 * The family's open tasks on the home screen: everyone's, not just mine.
 * Overdue and dated ones first, then the shared ones and mine, then the rest.
 */
export function FamilyTasks({ today }: { today: string }) {
  const tt = useTranslations("today");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [busy, setBusy] = useState(false);
  const base = `/trips/${snap.trip!.id}`;
  const me = snap.me.travelerId;
  const travelers = live(snap.travelers);
  const open = live(snap.tasks).filter((x) => !x.done);

  const rank = (x: Task) => {
    const day = dueDay(x.due_at);
    if (day && day < today) return 0;
    if (day) return 1;
    if (!x.assignee_traveler_id || x.assignee_traveler_id === me) return 2;
    return 3;
  };
  const sorted = [...open].sort((a, b) => rank(a) - rank(b) || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || a.position.localeCompare(b.position));

  // Tasks typed in before anyone else joined all land on one person. Offer to share them.
  const owners = new Set(open.map((x) => x.assignee_traveler_id));
  const soleOwner = open.length >= 3 && travelers.length > 1 && owners.size === 1 ? [...owners][0] : null;

  async function toggle(id: string, done: boolean) {
    await patchRow(store, "tasks", id, { done }).catch(() => showToast({ message: tc("errorGeneric") }));
  }
  async function shareAll() {
    setBusy(true);
    try {
      for (const x of open) await patchRow(store, "tasks", x.id, { assignee_traveler_id: null });
      showToast({ message: tt("sharedAll", { n: open.length }) });
    } catch {
      showToast({ message: tc("errorGeneric") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
        <h3 className="text-lg font-extrabold">{tt("ourTasks")}</h3>
        <Link href={`${base}/lists/tasks`} className="text-sm font-bold underline underline-offset-4">
          {tt("allTasks", { n: open.length })}
        </Link>
      </div>
      {soleOwner && canEdit ? (
        <div className="mt-3 flex flex-col gap-2 border-2 border-dashed border-ink p-3">
          <p className="text-sm font-bold">{tt("allOnOne", { n: open.length, name: travelerLabel(snap, soleOwner) ?? "" })}</p>
          <button type="button" disabled={busy} onClick={() => void shareAll()} className="flex min-h-11 items-center justify-center bg-ink px-3 font-extrabold text-on-ink disabled:opacity-60">
            {tt("shareAll")}
          </button>
        </div>
      ) : null}
      {open.length === 0 ? (
        <p className="py-3 text-sm text-ink-2">{tt("noOpen")}</p>
      ) : (
        <ul>
          {sorted.slice(0, SHOWN).map((x) => {
            const day = dueDay(x.due_at);
            const overdue = day !== null && day < today;
            const who = x.assignee_traveler_id === me && me ? tt("me") : travelerLabel(snap, x.assignee_traveler_id);
            return (
              <li key={x.id} className="flex min-h-14 items-center gap-1 border-b border-hair">
                <label className="grid size-11 shrink-0 cursor-pointer place-items-center">
                  <input
                    type="checkbox"
                    checked={x.done}
                    disabled={!canToggle(snap, x.assignee_traveler_id)}
                    onChange={() => void toggle(x.id, !x.done)}
                    aria-label={x.title}
                    className="size-[26px] cursor-pointer appearance-none rounded-full border-[2.5px] border-c-tasks bg-surface checked:bg-c-tasks"
                  />
                </label>
                <span className="flex min-w-0 flex-1 flex-col py-1">
                  <span className="text-[17px] leading-snug">{x.title}</span>
                  <span className={cn("text-xs font-bold", x.assignee_traveler_id === me && me ? "text-c-tasks" : "text-ink-2")}>{who ?? tc("everyone")}</span>
                </span>
                {day ? (
                  overdue ? (
                    <SnoozeButton task={x} today={today} label={`${Number(day.slice(8))}.${Number(day.slice(5, 7))}`} />
                  ) : (
                    <span className="px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-ink-2">{`${Number(day.slice(8))}.${Number(day.slice(5, 7))}`}</span>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {open.length > SHOWN ? (
        <Link href={`${base}/lists/tasks`} className="flex min-h-11 items-center text-sm font-bold text-ink-2">
          {tt("moreTasks", { n: open.length - SHOWN })}
        </Link>
      ) : null}
    </section>
  );
}
