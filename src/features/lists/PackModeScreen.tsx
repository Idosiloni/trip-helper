"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { live } from "./helpers";
import { canPack, isPacked, togglePacked, type PackMode } from "./packing-shared";

/** Full-screen packing for one bag (SPEC 6.3): huge rows, one tap per item, a finish moment. */
export function PackModeScreen() {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const { bagId } = useParams<{ bagId: string }>();
  const params = useSearchParams();
  const mode: PackMode = params.get("mode") === "back" ? "back" : "out";
  const snap = useTripData();
  const store = useTripStore();
  const reduce = useReducedMotion();
  const trip = snap.trip!;
  const bag = snap.bags.find((b) => b.id === bagId && !b.deleted_at);
  const items = live(snap.packing).filter((it) => it.bag_id === bagId);
  const done = items.filter((it) => isPacked(it, mode)).length;
  const complete = items.length > 0 && done === items.length;

  // Celebrate only when the last item gets packed now, not when opening a full bag.
  const [celebrate, setCelebrate] = useState(false);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 2200);
      wasComplete.current = true;
      return () => clearTimeout(id);
    }
    wasComplete.current = complete;
  }, [complete]);

  const back = `/trips/${trip.id}/lists/packing`;
  if (!bag) {
    return (
      <p className="py-10">
        <Link href={back} className="font-bold underline">
          {t("bagGone")}
        </Link>
      </p>
    );
  }

  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <Link href={back} aria-label={tc("back")} className="-ms-3 grid size-11 place-items-center">
          <Icon name="back" className="rtl:-scale-x-100" strokeWidth={2.5} />
        </Link>
        <h2 className="display print-offset flex-1 pt-1 text-[3rem]">{bag.label}</h2>
        <span className="text-sm font-bold text-ink-2">{mode === "out" ? t("outbound") : t("homebound")}</span>
      </div>

      <div aria-hidden="true" className="h-3 border-2 border-ink bg-surface">
        <div className="h-full bg-trip transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="flex items-baseline gap-2" aria-live="polite">
        <span className="display text-[4rem] leading-[0.8] tabular-nums">
          {done}/{items.length}
        </span>
        <span className="text-lg font-bold">{complete ? t("bagDone") : t("packedLabel")}</span>
      </p>

      {items.length === 0 ? <p className="text-ink-2">{t("bagEmpty")}</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((it) => {
          const packed = isPacked(it, mode);
          return (
            <li key={it.id}>
              <button
                type="button"
                disabled={!canPack(snap, it)}
                aria-pressed={packed}
                onClick={() => void togglePacked(store, it, mode).catch(() => showToast({ message: tc("errorGeneric") }))}
                className={`flex min-h-16 w-full items-center gap-4 border-2 border-ink px-4 text-start transition-colors disabled:opacity-50 ${packed ? "bg-surface-2 text-ink-3" : "bg-surface"}`}
              >
                <span className={`grid size-9 shrink-0 place-items-center border-[3px] border-ink ${packed ? "bg-ink" : ""}`}>
                  {packed ? <Icon name="check" size={22} strokeWidth={4} className="text-on-ink" /> : null}
                </span>
                <span className={`flex-1 text-xl font-bold ${packed ? "line-through" : ""}`}>
                  {it.title}
                  {it.qty > 1 ? ` ×${it.qty}` : ""}
                </span>
                {mode === "out" && it.state === "missing" ? <span className="text-sm font-extrabold text-trip-ink">{t("toBuy")}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {celebrate ? (
          <motion.div
            key="done"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-paper/80"
          >
            <p className="display print-offset text-[5rem]">{t("bagDone")}</p>
            {reduce ? null : (
              <motion.span
                aria-hidden="true"
                className="absolute top-1/3 text-trip-ink"
                initial={{ x: "60vw", y: 40, rotate: -20 }}
                animate={{ x: "-60vw", y: -60, rotate: -20 }}
                transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
              >
                <Icon name="plane" size={72} strokeWidth={1.6} />
              </motion.span>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
