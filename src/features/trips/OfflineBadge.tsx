"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { showToast } from "@/components/ui/Toast";
import { useTripData, useTripStore } from "../trip-data/TripDataProvider";

function ago(iso: string, now: number): { unit: "minutes" | "hours" | "days"; n: number } {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 60) return { unit: "minutes", n: min };
  if (min < 60 * 24) return { unit: "hours", n: Math.round(min / 60) };
  return { unit: "days", n: Math.round(min / 1440) };
}

/** "לא מחובר · עודכן לפני X" and how many changes wait to be sent (SPEC §10). */
export function OfflineBadge() {
  const t = useTranslations("offline");
  const data = useTripData();
  const store = useTripStore();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    store.setRejectedHandler(() => showToast({ message: t("rejected") }));
    return () => store.setRejectedHandler(null);
  }, [store, t]);

  if (data.live && !data.pending) return null;
  const since = data.syncedAt && now ? ago(data.syncedAt, now) : null;
  return (
    <span role="status" className="flex flex-col items-end border-2 border-ink-2 px-1.5 py-0.5 text-end text-[11px] font-bold leading-tight text-ink-2">
      <span>{data.live ? t("sending") : since ? t(`since.${since.unit}`, { n: since.n }) : t("offline")}</span>
      {data.pending ? <span>{t("pending", { n: data.pending })}</span> : null}
    </span>
  );
}
