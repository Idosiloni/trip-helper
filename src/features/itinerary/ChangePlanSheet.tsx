"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { byPosition, keysAfter, lastKey } from "@/lib/position";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Stop } from "../trip-data/types";
import { stopLabel, stopsOfDay } from "./helpers";

const REASONS = ["rain", "tired", "closed", "late"] as const;

/**
 * "Plans changed" for one day. Two ways out:
 * - right away, no chat: move what's left to tomorrow, or take it out of the plan (with undo);
 * - prompt 9: pick a reason and ask a chat for a new plan for the rest of the day.
 */
export function ChangePlanButton({ date, block = true }: { date: string; block?: boolean }) {
  const t = useTranslations("changePlan");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const openPrompt = useOpenPrompt();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [other, setOther] = useState("");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const text = other.trim() || (reason ? t(`reasons.${reason as (typeof REASONS)[number]}`) : "");

  const dayIndex = snap.days.findIndex((d) => d.date === date);
  const day = snap.days[dayIndex];
  const tomorrow = dayIndex >= 0 ? (snap.days[dayIndex + 1] ?? null) : null;
  const visited = new Set(snap.places.filter((p) => p.status === "visited").map((p) => p.id));
  // What's left today: stops whose place isn't marked visited yet.
  const left = day ? [...stopsOfDay(snap, day.id)].sort(byPosition).filter((s) => !(s.place_id && visited.has(s.place_id))) : [];
  const chosen = left.filter((s) => !skip.has(s.id));

  async function move(to: string | null) {
    if (!chosen.length) return;
    setBusy(true);
    const before = chosen.map((s) => ({ id: s.id, day_id: s.day_id, position: s.position }));
    const target = to ? stopsOfDay(snap, to) : stopsOfDay(snap, null);
    const positions = keysAfter(lastKey(target), chosen.length);
    try {
      for (const [i, s] of chosen.entries()) await patchRow(store, "stops", s.id, { day_id: to, position: positions[i] });
      setOpen(false);
      setSkip(new Set());
      showToast({
        message: to ? t("movedTomorrow", { n: chosen.length }) : t("movedOut", { n: chosen.length }),
        actionLabel: t("undo"),
        duration: 8000,
        onAction: () => void Promise.all(before.map((b) => patchRow(store, "stops", b.id, { day_id: b.day_id, position: b.position }))).catch(() => showToast({ message: tc("errorGeneric") })),
      });
    } catch {
      showToast({ message: tc("errorGeneric") });
    } finally {
      setBusy(false);
    }
  }

  // Opening on the day itself: stops whose time is already over an hour past start unchecked
  // (they probably happened, just weren't marked), the rest checked.
  function openSheet() {
    const now = new Date();
    const isToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` === date;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const past = isToday
      ? left.filter((s) => {
          if (!s.start_time) return false;
          const [h, m] = s.start_time.split(":").map(Number);
          return h * 60 + m + (s.duration_min ?? 60) < nowMin;
        })
      : [];
    setSkip(new Set(past.map((s) => s.id)));
    setOpen(true);
  }

  function toggle(s: Stop) {
    const next = new Set(skip);
    if (next.has(s.id)) next.delete(s.id);
    else next.add(s.id);
    setSkip(next);
  }

  return (
    <>
      <Button variant="secondary" block={block} icon={<Icon name="route" size={18} />} onClick={openSheet}>
        {t("button")}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("title")} closeLabel={tc("close")}>
        <div className="flex flex-col gap-5">
          {day?.plan_b ? (
            <section className="border-2 border-ink bg-surface p-3">
              <h3 className="font-extrabold">{t("planB")}</h3>
              <p className="mt-1">{day.plan_b}</p>
            </section>
          ) : null}
          {canEdit && left.length ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-extrabold">{t("leftTitle")}</h3>
              <ul className="flex flex-col border-t-2 border-ink">
                {left.map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-hair">
                      <input type="checkbox" checked={!skip.has(s.id)} onChange={() => toggle(s)} className="size-6 shrink-0 accent-[var(--ink)]" />
                      <span className="w-11 shrink-0 text-xs font-bold tabular-nums text-ink-2">{s.start_time?.slice(0, 5) ?? ""}</span>
                      <span className="flex-1">{stopLabel(snap, s)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className={cn("grid gap-2", tomorrow ? "grid-cols-2" : "grid-cols-1")}>
                {tomorrow ? (
                  <Button loading={busy} disabled={!chosen.length} onClick={() => void move(tomorrow.id)}>
                    {t("toTomorrow", { n: chosen.length })}
                  </Button>
                ) : null}
                <Button variant="secondary" disabled={busy || !chosen.length} onClick={() => void move(null)}>
                  {t("outOfPlan")}
                </Button>
              </div>
              <p className="text-xs text-ink-2">{t("outHint")}</p>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="font-extrabold">{t("askTitle")}</h3>
            <div role="group" aria-label={t("reason")} className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r && !other.trim()}
                  onClick={() => {
                    setReason(r);
                    setOther("");
                  }}
                  className={`min-h-11 border-2 border-ink px-3 text-sm font-bold ${reason === r && !other.trim() ? "bg-ink text-on-ink" : "bg-surface"}`}
                >
                  {t(`reasons.${r}`)}
                </button>
              ))}
            </div>
            <TextField label={t("other")} value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} />
            <Button
              size="lg"
              block
              variant={left.length && canEdit ? "secondary" : "primary"}
              disabled={!text}
              icon={<Icon name="copy" size={18} />}
              onClick={() => {
                setOpen(false);
                openPrompt("p09-change-plan", { date, reason: text });
              }}
            >
              {t("makePrompt")}
            </Button>
          </section>
        </div>
      </Sheet>
    </>
  );
}
