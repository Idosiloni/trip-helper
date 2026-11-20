"use client";

import { useTranslations } from "next-intl";
import { TextField } from "@/components/ui/TextField";
import { setFakeToday, useFakeToday } from "@/lib/use-today";

/** Settings: see the app as if it were another day (checking "Today" before the trip). */
export function SimulatedDate({ start, end }: { start: string | null; end: string | null }) {
  const t = useTranslations("settings");
  const fake = useFakeToday();
  return (
    <section className="mt-8 flex flex-col gap-2">
      <h3 className="text-sm font-extrabold">{t("fakeDate")}</h3>
      <p className="text-sm text-ink-2">{t("fakeDateHint")}</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField label={t("fakeDateLabel")} type="date" value={fake ?? ""} min={start ?? undefined} max={end ?? undefined} onChange={(e) => setFakeToday(e.target.value || null)} />
        </div>
        {fake ? (
          <button type="button" onClick={() => setFakeToday(null)} className="mb-1 min-h-11 px-2 text-sm font-bold underline underline-offset-4">
            {t("fakeDateOff")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
