"use client";

import { useTranslations } from "next-intl";
import { SubHeader } from "@/components/app/SubHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { useToday } from "@/lib/use-today";
import { patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { ListKey } from "../trip-data/types";

const DAYS = 30;

/** Trash (SPEC §11): everything deleted in the last 30 days, restorable with one tap. */
export function TrashScreen() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const base = `/trips/${snap.trip!.id}`;
  const today = useToday();
  // Midnight of the first day still kept; derived from the date so render stays pure.
  const cutoff = today ? Date.parse(`${today}T00:00:00`) - DAYS * 86_400_000 : 0;

  const entries: { key: ListKey; id: string; title: string; deletedAt: string }[] = [];
  const add = (key: ListKey, rows: { id: string; deleted_at: string | null }[], title: (r: never) => string) => {
    for (const r of rows) if (r.deleted_at && new Date(r.deleted_at).getTime() > cutoff) entries.push({ key, id: r.id, title: title(r as never), deletedAt: r.deleted_at });
  };
  add("tasks", snap.tasks, (r: { title: string }) => r.title);
  add("packing", snap.packing, (r: { title: string }) => r.title);
  add("travelers", snap.travelers, (r: { label: string }) => r.label);
  add("bags", snap.bags, (r: { label: string }) => r.label);
  add("taskGroups", snap.taskGroups, (r: { title: string }) => r.title);
  add("places", snap.places, (r: { name: string }) => r.name);
  add("stops", snap.stops, (r: { free_text: string | null; place_id: string | null }) => r.free_text ?? snap.places.find((p) => p.id === r.place_id)?.name ?? "");
  add("bookings", snap.bookings, (r: { title: string }) => r.title);
  add("purchases", snap.purchases, (r: { title: string }) => r.title);
  add("notes", snap.notes, (r: { title: string }) => r.title);
  add("journal", snap.journal, (r: { body: string }) => (r.body.length > 60 ? `${r.body.slice(0, 60)}…` : r.body));
  entries.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));

  async function restore(e: (typeof entries)[number]) {
    try {
      await patchRow(store, e.key, e.id, { deleted_at: null } as never);
      showToast({ message: t("restored", { title: e.title }) });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("title")} backHref={`${base}/settings`} backLabel={tc("back")} />
      <p className="text-ink-2">{t("intro", { days: DAYS })}</p>
      {entries.length === 0 ? (
        <EmptyState icon="trash" title={t("emptyTitle")} />
      ) : (
        <ul className="flex flex-col border-t-2 border-ink">
          {entries.map((e) => (
            <li key={`${e.key}:${e.id}`} className="flex min-h-14 items-center gap-3 border-b border-hair py-2">
              <span className="flex flex-1 flex-col">
                <span className="text-[17px]">{e.title}</span>
                <span className="text-xs text-ink-2">
                  {t(`kinds.${e.key}`)} · {new Date(e.deletedAt).toLocaleDateString("he-IL")}
                </span>
              </span>
              {canEdit ? (
                <button type="button" onClick={() => restore(e)} className="flex min-h-11 items-center gap-1.5 px-2 font-bold underline underline-offset-4">
                  <Icon name="undo" size={18} />
                  {t("restore")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
