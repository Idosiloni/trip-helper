"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import type { DayWeather } from "@/lib/weather";
import { copyText } from "../prompts/clipboard";
import { useTripData } from "../trip-data/TripDataProvider";
import type { TripDay } from "../trip-data/types";
import { dayText } from "./day-text";

/** "Send the day to the family": WhatsApp (or any app via the share sheet), or copy. */
export function ShareDay({ day, weather }: { day: TripDay; weather?: DayWeather }) {
  const t = useTranslations("shareDay");
  const snap = useTripData();
  const text = () => dayText(snap, day, { weather });

  async function share() {
    const body = text();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: body });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // the user closed the share sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
  }
  async function copy() {
    showToast({ message: (await copyText(text())) ? t("copied") : t("copyFailed") });
  }

  return (
    <div className="flex items-stretch border-2 border-ink">
      <button type="button" onClick={() => void share()} className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-surface px-3 text-sm font-extrabold">
        <Icon name="share" size={16} />
        {t("send")}
      </button>
      <button type="button" onClick={() => void copy()} aria-label={t("copy")} className="grid w-12 place-items-center border-s-2 border-ink bg-surface">
        <Icon name="copy" size={16} />
      </button>
    </div>
  );
}
