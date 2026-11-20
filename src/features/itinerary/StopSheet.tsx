"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { keyAfter } from "@/lib/position";
import { live } from "../lists/helpers";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Stop } from "../trip-data/types";
import { stopsOfDay } from "./helpers";

type Tod = "" | "morning" | "noon" | "evening";
type Draft = { placeId: string; freeText: string; tod: Tod; start: string; minutes: string; transport: string; notes: string; dayId: string };

const toDraft = (s: Stop | null, dayId: string | null): Draft => ({
  placeId: s?.place_id ?? "",
  freeText: s?.free_text ?? "",
  tod: (s?.time_of_day ?? "") as Tod,
  start: s?.start_time?.slice(0, 5) ?? "",
  minutes: s?.duration_min ? String(s.duration_min) : "",
  transport: s?.transport_note ?? "",
  notes: s?.notes ?? "",
  dayId: s ? (s.day_id ?? "") : (dayId ?? ""),
});

/** Add or edit a stop: a place from the list or free text, time, duration, how to get there, move to another day. */
export function StopSheet({ stop, open, dayId, onClose }: { stop: Stop | null; open: boolean; dayId: string | null; onClose: () => void }) {
  const t = useTranslations("plan");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [draft, setDraft] = useState<Draft | null>(null);
  const d = draft ?? toDraft(stop, dayId);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });

  // Places not yet scheduled first, then the rest.
  const scheduled = new Set(live(snap.stops).filter((s) => s.day_id && s.place_id).map((s) => s.place_id));
  const places = live(snap.places).filter((p) => p.status !== "skipped");
  const placeOptions = [...places.filter((p) => !scheduled.has(p.id)), ...places.filter((p) => scheduled.has(p.id))];

  function close() {
    setDraft(null);
    onClose();
  }

  async function save() {
    const values = {
      place_id: d.placeId || null,
      free_text: d.placeId ? null : d.freeText.trim() || null,
      time_of_day: d.tod || null,
      start_time: d.start || null,
      duration_min: /^\d+$/.test(d.minutes) ? Math.min(1440, Math.max(5, Number(d.minutes))) : null,
      transport_note: d.transport.trim() || null,
      notes: d.notes.trim() || null,
      day_id: d.dayId || null,
    };
    if (!values.place_id && !values.free_text) return;
    setBusy(true);
    try {
      if (stop) {
        const moved = values.day_id !== stop.day_id;
        await patchRow(store, "stops", stop.id, moved ? { ...values, position: keyAfter(stopsOfDay(snap, values.day_id).at(-1)?.position) } : values);
      } else {
        await insertRow(store, "stops", { ...values, position: keyAfter(stopsOfDay(snap, values.day_id).at(-1)?.position) });
      }
      close();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!stop) return;
    close();
    const undo = await softDelete(store, "stops", stop.id).catch(() => null);
    if (undo) showToast({ message: t("stopDeleted"), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <Sheet open={open} onClose={close} title={stop ? t("editStop") : t("addStop")} closeLabel={tc("close")} side>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Select
          label={t("place")}
          value={d.placeId}
          onChange={(e) => set({ placeId: e.target.value })}
          options={[{ value: "", label: t("freeTextOption") }, ...placeOptions.map((p) => ({ value: p.id, label: `${p.name}${p.city ? ` · ${p.city}` : ""}${scheduled.has(p.id) ? ` (${t("alreadyScheduled")})` : ""}` }))]}
        />
        {!d.placeId ? <TextField label={t("whatToDo")} placeholder={t("whatToDoPlaceholder")} value={d.freeText} maxLength={200} onChange={(e) => set({ freeText: e.target.value })} /> : null}
        <Segmented<Tod>
          label={t("partOfDay")}
          value={d.tod}
          onChange={(tod) => set({ tod })}
          options={[
            { value: "", label: t("tod.none") },
            { value: "morning", label: t("tod.morning") },
            { value: "noon", label: t("tod.noon") },
            { value: "evening", label: t("tod.evening") },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("startTime")} type="time" value={d.start} onChange={(e) => set({ start: e.target.value })} />
          <TextField label={t("minutes")} inputMode="numeric" value={d.minutes} onChange={(e) => set({ minutes: e.target.value.replace(/\D/g, "") })} />
        </div>
        <TextField label={t("transport")} placeholder={t("transportPlaceholder")} value={d.transport} maxLength={300} onChange={(e) => set({ transport: e.target.value })} />
        <TextField label={t("notes")} value={d.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />
        <Select label={t("day")} value={d.dayId} onChange={(e) => set({ dayId: e.target.value })} options={[{ value: "", label: t("notScheduled") }, ...snap.days.map((x) => ({ value: x.id, label: `${x.date}${x.city ? ` · ${x.city}` : ""}` }))]} />
        {canEdit ? (
          <>
            <Button size="lg" block loading={busy} disabled={!d.placeId && !d.freeText.trim()} onClick={save}>
              {tc("save")}
            </Button>
            {stop ? (
              <Button variant="danger" block icon={<Icon name="trash" size={18} />} onClick={remove}>
                {tc("delete")}
              </Button>
            ) : null}
          </>
        ) : null}
      </fieldset>
    </Sheet>
  );
}
