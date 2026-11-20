"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { shortDate } from "../itinerary/helpers";
import { lastImport, type LastImport } from "./undo";

/** "The last paste: plan, 20.11 14:05 · undo". One tap moves it all to the trash. */
export function LastPasteBar({ tripId, onUndo }: { tripId: string; onUndo: (id: string) => Promise<void> }) {
  const t = useTranslations("import");
  const [last, setLast] = useState<LastImport | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    lastImport(tripId)
      .then((x) => alive && setLast(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tripId]);
  if (!last) return null;
  const at = new Date(last.created_at);
  const date = at.toLocaleDateString("sv-SE");
  const time = at.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const kind = (["tasks", "packing", "places", "itinerary", "purchases", "notes"] as const).find((k) => k === last.kind);
  return (
    <div className="flex items-center gap-3 border-2 border-dashed border-ink p-3 text-sm">
      <Icon name="undo" size={18} className="shrink-0 text-trip-ink" />
      <span className="flex-1">{t("lastPaste", { what: kind ? t(`kinds.${kind}`) : last.kind, date: shortDate(date), time })}</span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onUndo(last.id);
          setLast(null);
          setBusy(false);
        }}
        className="min-h-11 shrink-0 px-2 font-extrabold underline underline-offset-4 disabled:opacity-60"
      >
        {t("undoPaste")}
      </button>
    </div>
  );
}
