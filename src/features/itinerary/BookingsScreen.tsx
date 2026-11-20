"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { useToday } from "@/lib/use-today";
import { allTimeZones, HOME_TZ, utcToWallTime, wallTimeToUtc } from "@/lib/tz";
import { live } from "../lists/helpers";
import { copyText } from "../prompts/clipboard";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Booking } from "../trip-data/types";
import { bookingSpan, liveBookings, shortDate, weekday } from "./helpers";
import { BOOKING_ICON } from "./DaysScreen";
import { PlanTabs } from "./PlanTabs";

const KINDS = ["flight", "hotel", "train", "attraction", "car", "other"] as const;

type Draft = {
  kind: Booking["kind"];
  title: string;
  startDate: string;
  startTime: string;
  startTz: string;
  endDate: string;
  endTime: string;
  endTz: string;
  code: string;
  link: string;
  placeId: string;
  notes: string;
  address: string;
  price: string;
  cancelBy: string;
};

function toDraft(b: Booking | null, defaultTz: string): Draft {
  const s = b?.starts_at ? utcToWallTime(b.starts_at, b.starts_tz ?? defaultTz) : null;
  const e = b?.ends_at ? utcToWallTime(b.ends_at, b.ends_tz ?? b.starts_tz ?? defaultTz) : null;
  return {
    kind: b?.kind ?? "flight",
    title: b?.title ?? "",
    startDate: s?.date ?? "",
    startTime: s?.time ?? "",
    startTz: b?.starts_tz ?? defaultTz,
    endDate: e?.date ?? "",
    endTime: e?.time ?? "",
    endTz: b?.ends_tz ?? b?.starts_tz ?? defaultTz,
    code: b?.confirmation_code ?? "",
    link: b?.link ?? "",
    placeId: b?.place_id ?? "",
    notes: b?.notes ?? "",
    address: b?.address ?? "",
    price: b?.price ?? "",
    cancelBy: b?.cancel_by ?? "",
  };
}

function BookingSheet({ booking, open, onClose, defaultTz }: { booking: Booking | null; open: boolean; onClose: () => void; defaultTz: string }) {
  const t = useTranslations("bookings");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [draft, setDraft] = useState<Draft | null>(null);
  const d = draft ?? toDraft(booking, defaultTz);
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const zones = allTimeZones();
  const tzOptions = zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));

  const startsAt = d.startDate ? wallTimeToUtc(d.startDate, d.startTime || "12:00", d.startTz) : null;
  const endsAt = d.endDate ? wallTimeToUtc(d.endDate, d.endTime || "12:00", d.endTz) : null;
  const badOrder = Boolean(startsAt && endsAt && endsAt < startsAt);
  const linkOk = !d.link.trim() || /^https?:\/\/\S+$/i.test(d.link.trim());

  function close() {
    setDraft(null);
    setShowCode(false);
    onClose();
  }

  async function save() {
    if (!d.title.trim() || badOrder || !linkOk) return;
    const values = {
      kind: d.kind,
      title: d.title.trim(),
      starts_at: startsAt,
      starts_tz: startsAt ? d.startTz : null,
      ends_at: endsAt,
      ends_tz: endsAt ? d.endTz : null,
      confirmation_code: d.code.trim() || null,
      link: d.link.trim() || null,
      place_id: d.placeId || null,
      notes: d.notes.trim() || null,
      address: d.address.trim() || null,
      price: d.price.trim() || null,
      cancel_by: d.cancelBy || null,
    };
    setBusy(true);
    try {
      if (booking) await patchRow(store, "bookings", booking.id, values);
      else await insertRow(store, "bookings", values);
      close();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!booking) return;
    close();
    const undo = await softDelete(store, "bookings", booking.id).catch(() => null);
    if (undo) showToast({ message: t("deleted", { title: booking.title }), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <Sheet open={open} onClose={close} title={booking ? t("edit") : t("add")} closeLabel={tc("close")} side>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Select label={t("kind")} value={d.kind} onChange={(e) => set({ kind: e.target.value as Booking["kind"] })} options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
        <TextField label={t("title")} placeholder={t(`titlePlaceholder.${d.kind}`)} value={d.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
        <fieldset className="flex flex-col gap-2 border-t border-hair pt-3">
          <legend className="text-sm font-extrabold">{d.kind === "hotel" ? t("checkIn") : t("start")}</legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("date")} type="date" value={d.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            <TextField label={t("time")} type="time" value={d.startTime} onChange={(e) => set({ startTime: e.target.value })} />
          </div>
          <Select label={t("tz")} value={d.startTz} onChange={(e) => set({ startTz: e.target.value, endTz: d.endTz === d.startTz ? e.target.value : d.endTz })} options={tzOptions} />
        </fieldset>
        <fieldset className="flex flex-col gap-2 border-t border-hair pt-3">
          <legend className="text-sm font-extrabold">{d.kind === "hotel" ? t("checkOut") : t("end")}</legend>
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("date")} type="date" value={d.endDate} min={d.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} />
            <TextField label={t("time")} type="time" value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} error={badOrder ? t("badOrder") : null} />
          </div>
          <Select label={t("tz")} value={d.endTz} onChange={(e) => set({ endTz: e.target.value })} options={tzOptions} />
        </fieldset>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField label={t("code")} hint={t("codeHint")} type={showCode ? "text" : "password"} autoComplete="off" dir="ltr" value={d.code} maxLength={60} onChange={(e) => set({ code: e.target.value })} />
          </div>
          <button type="button" onClick={() => setShowCode(!showCode)} className="mb-6 min-h-11 px-2 text-sm font-bold underline underline-offset-4">
            {showCode ? t("hide") : t("show")}
          </button>
          {d.code ? (
            <button type="button" aria-label={t("copyCode")} onClick={async () => (await copyText(d.code)) && showToast({ message: t("codeCopied") })} className="mb-6 grid size-11 place-items-center">
              <Icon name="copy" size={18} />
            </button>
          ) : null}
        </div>
        <TextField label={t("link")} type="url" dir="ltr" inputMode="url" placeholder="https://" value={d.link} onChange={(e) => set({ link: e.target.value })} error={linkOk ? null : t("badLink")} />
        {d.kind === "hotel" ? <TextField label={t("address")} value={d.address} maxLength={300} onChange={(e) => set({ address: e.target.value })} /> : null}
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("cancelBy")} hint={t("cancelByHint")} type="date" value={d.cancelBy} onChange={(e) => set({ cancelBy: e.target.value })} />
          <TextField label={t("price")} placeholder={t("pricePlaceholder")} value={d.price} maxLength={60} onChange={(e) => set({ price: e.target.value })} />
        </div>
        <Select label={t("place")} value={d.placeId} onChange={(e) => set({ placeId: e.target.value })} options={[{ value: "", label: t("noPlace") }, ...live(snap.places).map((p) => ({ value: p.id, label: p.name }))]} />
        <TextField label={t("notes")} value={d.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />
        {canEdit ? (
          <>
            <Button size="lg" block loading={busy} disabled={!d.title.trim() || badOrder || !linkOk} onClick={save}>
              {tc("save")}
            </Button>
            {booking ? (
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

const GROUPS = [
  { key: "travel", kinds: ["flight", "train", "car"], icon: "plane" },
  { key: "lodging", kinds: ["hotel"], icon: "bed" },
  { key: "tickets", kinds: ["attraction", "other"], icon: "star" },
] as const satisfies readonly { key: string; kinds: readonly Booking["kind"][]; icon: IconName }[];

function BookingRow({ b, show, past, onOpen }: { b: Booking; show: (iso: string | null, tz: string | null) => string | null; past: boolean; onOpen: () => void }) {
  const t = useTranslations("bookings");
  const { start, end } = bookingSpan(b);
  const nights = b.kind === "hotel" && start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) : 0;
  const hours = b.kind !== "hotel" && b.starts_at && b.ends_at ? (Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 3_600_000 : 0;
  async function copyCode() {
    if (b.confirmation_code && (await copyText(b.confirmation_code))) showToast({ message: t("codeCopied") });
  }
  return (
    <li className={cn("flex items-stretch border-2 border-ink bg-surface shadow-[2px_2px_0_0_var(--trip-tint)]", past && "opacity-55")}>
      <button type="button" onClick={onOpen} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-start">
        <Icon name={BOOKING_ICON[b.kind]} className="shrink-0 text-trip-ink" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-bold leading-tight">{b.title}</span>
          <span className="text-xs text-ink-2 tabular-nums">
            {b.kind === "hotel" ? `${t("checkIn")} ` : ""}
            {show(b.starts_at, b.starts_tz) ?? t("noTime")}
          </span>
          {b.ends_at ? (
            <span className="text-xs text-ink-2 tabular-nums">
              {b.kind === "hotel" ? `${t("checkOut")} ` : "→ "}
              {show(b.ends_at, b.ends_tz ?? b.starts_tz)}
            </span>
          ) : null}
          {b.address ? <span className="text-xs text-ink-2">{b.address}</span> : null}
          {b.cancel_by || b.price ? (
            <span className="flex flex-wrap gap-x-2 text-xs">
              {b.cancel_by ? <span className={cn("font-bold", !past && "text-trip-ink")}>{t("freeCancelUntil", { date: shortDate(b.cancel_by) })}</span> : null}
              {b.price ? <span className="text-ink-2">{b.price}</span> : null}
            </span>
          ) : null}
          {nights > 0 || hours > 0 ? (
            <span className="text-xs font-bold">{nights > 0 ? t("nights", { n: nights }) : t("duration", { h: Math.floor(hours), m: Math.round((hours % 1) * 60) })}</span>
          ) : null}
        </span>
      </button>
      {b.confirmation_code ? (
        <button type="button" onClick={() => void copyCode()} aria-label={t("copyCode")} className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-s border-hair text-[11px] font-bold">
          <Icon name="copy" size={16} />
          {t("codeShort")}
        </button>
      ) : null}
      {b.link ? (
        <a href={b.link} target="_blank" rel="noopener noreferrer" aria-label={t("openLink", { title: b.title })} className="grid w-12 shrink-0 place-items-center border-s border-hair">
          <Icon name="link" size={17} />
        </a>
      ) : null}
    </li>
  );
}

export function BookingsScreen() {
  const t = useTranslations("bookings");
  const snap = useTripData();
  const canEdit = useCanEdit();
  const params = useSearchParams();
  const [open, setOpen] = useState<Booking | "new" | null>(() => {
    const id = params.get("open");
    return id ? (snap.bookings.find((b) => b.id === id) ?? null) : null;
  });
  const [homeTime, setHomeTime] = useState(false);
  const today = useToday();
  const bookings = liveBookings(snap);
  // Default zone for new bookings: the one this trip uses most, else the device's.
  const used = bookings.map((b) => b.starts_tz).filter((z): z is string => !!z && z !== HOME_TZ);
  const defaultTz = used.sort((a, b) => used.filter((x) => x === b).length - used.filter((x) => x === a).length)[0] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const isPast = (b: Booking) => {
    const end = b.ends_at ?? b.starts_at;
    return Boolean(today && end && utcToWallTime(end, b.ends_tz ?? b.starts_tz ?? HOME_TZ).date < today);
  };
  const show = (iso: string | null, tz: string | null) => {
    if (!iso) return null;
    const w = utcToWallTime(iso, homeTime ? HOME_TZ : (tz ?? HOME_TZ));
    return `${weekday(w.date)} ${shortDate(w.date)} · ${w.time}`;
  };

  return (
    <div className="flex flex-col">
      <PlanTabs tripId={snap.trip!.id} />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-ink-2">{homeTime ? t("showingIsrael") : t("showingLocal")}</p>
        <button type="button" aria-pressed={homeTime} onClick={() => setHomeTime(!homeTime)} className="min-h-11 text-sm font-bold underline underline-offset-4">
          {homeTime ? t("toLocal") : t("toIsrael")}
        </button>
      </div>
      {bookings.length === 0 ? (
        <EmptyState icon="plane" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => {
            const list = bookings.filter((b) => (g.kinds as readonly Booking["kind"][]).includes(b.kind));
            if (!list.length) return null;
            return (
              <section key={g.key} className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 border-b-2 border-ink pb-1 text-lg font-extrabold">
                  <Icon name={g.icon} size={18} className="text-trip-ink" />
                  {t(`groups.${g.key}`)}
                  <span className="text-sm text-ink-2">{list.length}</span>
                </h3>
                <ul className="flex flex-col gap-2">
                  {list.map((b) => (
                    <BookingRow key={b.id} b={b} show={show} past={isPast(b)} onOpen={() => setOpen(b)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {canEdit ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => setOpen("new")}>
            {t("add")}
          </Button>
          <Link href={`/trips/${snap.trip!.id}/plan/bookings/paste`} className="flex min-h-12 items-center justify-center gap-2 border-2 border-ink bg-surface px-3 font-bold">
            <Icon name="paste" size={16} />
            {t("fromEmail")}
          </Link>
        </div>
      ) : null}
      <BookingSheet booking={open && open !== "new" ? open : null} open={open !== null} onClose={() => setOpen(null)} defaultTz={defaultTz} />
    </div>
  );
}
