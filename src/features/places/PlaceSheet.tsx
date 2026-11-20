"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Stamp } from "@/components/ui/Stamp";
import { showToast } from "@/components/ui/Toast";
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from "@/lib/geo";
import { keyAfter } from "@/lib/position";
import { buildPrompt, CHAT_APPS, chatUrl } from "@/lib/prompts/registry";
import { useToday } from "@/lib/use-today";
import { live } from "../lists/helpers";
import { copyText } from "../prompts/clipboard";
import { promptContext } from "../prompts/context-from-store";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Place } from "../trip-data/types";
import { PlaceForm } from "./PlaceForm";

/** Prompt 10 inline: copy a question about this place, paste the answer back as a note. */
function AskAboutPlace({ place }: { place: Place }) {
  const t = useTranslations("places");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const today = useToday() ?? "";
  const canEdit = useCanEdit();
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const stop = snap.stops.find((s) => !s.deleted_at && s.place_id === place.id && s.day_id);
    const day = stop ? snap.days.find((d) => d.id === stop.day_id) : null;
    const lodging = day?.lodging_place_id ? snap.places.find((p) => p.id === day.lodging_place_id) : null;
    return buildPrompt("p10-place", promptContext(snap, "places", today), {
      place: { name: place.name, city: place.city, area: place.area, date: day?.date ?? null, lodgingArea: lodging?.area ?? lodging?.city ?? null },
    });
  }, [snap, place, today]);

  async function saveNote() {
    const text = answer.trim();
    if (!text) return;
    const notes = place.notes ? `${place.notes}\n\n${text}` : text;
    try {
      await patchRow(store, "places", place.id, { notes: notes.slice(0, 4000) });
      setAnswer("");
      setOpen(false);
      showToast({ message: t("noteSaved") });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} icon={<Icon name="copy" size={18} />}>
        {t("askAbout")}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 border-2 border-dashed border-ink p-3">
      <p className="text-sm text-ink-2">{t("askExplain")}</p>
      <Button onClick={async () => setCopied(await copyText(prompt))} icon={<Icon name={copied ? "check" : "copy"} size={18} />}>
        {copied ? t("copied") : t("copyQuestion")}
      </Button>
      <div className="grid grid-cols-3 gap-2">
        {CHAT_APPS.map((app) => (
          <a key={app.id} href={chatUrl(app, prompt)} target="_blank" rel="noopener noreferrer" onClick={() => void copyText(prompt)} className="flex min-h-11 items-center justify-center border-2 border-ink bg-surface text-sm font-bold">
            {app.label}
          </a>
        ))}
      </div>
      {canEdit ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">{t("pasteAnswer")}</span>
            <textarea rows={4} dir="auto" value={answer} onChange={(e) => setAnswer(e.target.value)} className="border-2 border-ink bg-surface p-2 text-sm" />
          </label>
          <Button disabled={!answer.trim()} onClick={saveNote}>
            {t("saveAsNote")}
          </Button>
        </>
      ) : null}
    </div>
  );
}

function Details({ place, onEdit, onClose }: { place: Place; onEdit: () => void; onClose: () => void }) {
  const t = useTranslations("places");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [dayId, setDayId] = useState("");
  const scheduled = snap.stops.filter((s) => !s.deleted_at && s.place_id === place.id && s.day_id).map((s) => snap.days.find((d) => d.id === s.day_id)?.date);

  const set = (patch: Partial<Place>) => patchRow(store, "places", place.id, patch).catch(() => showToast({ message: tc("errorGeneric") }));

  async function addToDay() {
    if (!dayId) return;
    const dayStops = live(snap.stops).filter((s) => s.day_id === dayId);
    try {
      await insertRow(store, "stops", { day_id: dayId, place_id: place.id, position: keyAfter(dayStops.at(-1)?.position) });
      showToast({ message: t("addedToDay", { date: snap.days.find((d) => d.id === dayId)?.date ?? "" }) });
      setDayId("");
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  async function remove() {
    onClose();
    const undo = await softDelete(store, "places", place.id).catch(() => null);
    if (undo) showToast({ message: t("deleted", { name: place.name }), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-ink-2">
          {t(`categories.${place.category}`)}
          {place.city ? ` · ${place.city}` : ""}
          {place.area ? ` · ${place.area}` : ""}
        </p>
        {place.hours_text ? <p className="text-sm">{place.hours_text}</p> : null}
        {place.lat === null ? <Stamp tone="muted">{t("noPin")}</Stamp> : null}
        {scheduled.length ? <p className="text-sm font-bold">{t("scheduledOn", { dates: scheduled.join(", ") })}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href={googleMapsSearchUrl(place)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-1.5 border-2 border-ink bg-surface font-bold">
          <Icon name="pin" size={18} />
          {t("openInMaps")}
        </a>
        <a href={googleMapsDirectionsUrl(place)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-1.5 bg-ink font-bold text-on-ink">
          <Icon name="route" size={18} />
          {t("navigate")}
        </a>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-bold">{t("status")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["want", "visited", "skipped"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={place.status === s} onClick={() => set({ status: s })} className={cn("min-h-12 border-2 border-ink font-bold", place.status === s ? "bg-ink text-on-ink" : "bg-surface")}>
              {t(`statuses.${s}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {place.status === "visited" ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-bold">{t("rating")}</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={t("stars", { n })} aria-pressed={place.rating === n} onClick={() => set({ rating: n })} className={cn("grid size-11 place-items-center border-2 border-ink text-lg font-extrabold", (place.rating ?? 0) >= n ? "bg-trip text-[#fffcf6]" : "bg-surface")}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {canEdit ? (
        <>
          <button type="button" aria-pressed={place.priority === "must"} onClick={() => set({ priority: place.priority === "must" ? "maybe" : "must" })} className="flex min-h-11 items-center gap-2 self-start font-bold">
            <span className={cn("grid size-6 place-items-center border-2 border-ink", place.priority === "must" && "bg-ink")}>{place.priority === "must" ? <Icon name="check" size={14} strokeWidth={4} className="text-on-ink" /> : null}</span>
            {t("mustSee")}
          </button>
          {snap.days.length ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select label={t("addToDay")} value={dayId} onChange={(e) => setDayId(e.target.value)} options={[{ value: "", label: t("chooseDay") }, ...snap.days.map((d) => ({ value: d.id, label: `${d.date}${d.city ? ` · ${d.city}` : ""}` }))]} />
              </div>
              <Button disabled={!dayId} onClick={addToDay}>
                {tc("add")}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {place.notes ? <p className="whitespace-pre-line border-s-4 border-trip ps-3 text-[15px]" dir="auto">{place.notes}</p> : null}

      <AskAboutPlace place={place} />

      {canEdit ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" icon={<Icon name="edit" size={18} />} onClick={onEdit}>
            {tc("edit")}
          </Button>
          <Button variant="danger" className="flex-1" icon={<Icon name="trash" size={18} />} onClick={remove}>
            {tc("delete")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PlaceSheet({ placeId, onClose }: { placeId: string | null; onClose: () => void }) {
  const tc = useTranslations("common");
  const snap = useTripData();
  const [editing, setEditing] = useState(false);
  const place = placeId ? (snap.places.find((p) => p.id === placeId) ?? null) : null;
  return (
    <>
      <Sheet open={place !== null && !editing} onClose={onClose} title={place?.name ?? ""} closeLabel={tc("close")} side>
        {place ? <Details key={place.id} place={place} onEdit={() => setEditing(true)} onClose={onClose} /> : null}
      </Sheet>
      {place ? <PlaceForm place={place} open={editing} onClose={() => setEditing(false)} /> : null}
    </>
  );
}
