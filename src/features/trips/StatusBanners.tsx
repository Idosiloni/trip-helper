"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { setFakeToday, useFakeToday } from "@/lib/use-today";
import { shortDate } from "../itinerary/helpers";
import { useTripData } from "../trip-data/TripDataProvider";

/**
 * Thin lines under the header: no connection (showing the copy on this device),
 * and a simulated date when one is on, so nobody mistakes it for the real day.
 */
export function StatusBanners({ base, width }: { base: string; width: string }) {
  const t = useTranslations("offline");
  const ts = useTranslations("settings");
  const data = useTripData();
  const fake = useFakeToday();
  if (data.live && !fake) return null;
  return (
    <div className="no-print px-3">
      <div className={`mx-auto flex ${width} flex-col gap-1`}>
        {!data.live ? (
          <p role="status" className="border-2 border-ink bg-surface-2 px-3 py-1.5 text-sm font-bold">
            {t("banner")}
          </p>
        ) : null}
        {fake ? (
          <p className="flex items-center gap-2 border-2 border-dashed border-ink px-3 py-1 text-sm font-bold">
            <span className="flex-1">{ts("fakeDateOn", { date: shortDate(fake) })}</span>
            <Link href={`${base}/settings`} className="underline underline-offset-4">
              {ts("fakeDateChange")}
            </Link>
            <button type="button" onClick={() => setFakeToday(null)} className="min-h-9 underline underline-offset-4">
              {ts("fakeDateOff")}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
