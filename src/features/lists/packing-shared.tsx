"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Stepper } from "@/components/ui/Stepper";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { keyAfter } from "@/lib/position";
import { PACKING_CATEGORIES } from "@/lib/tripdata/schemas";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Bag, PackingItem, TripSnapshot } from "../trip-data/types";
import { canToggle, live } from "./helpers";

export type PackMode = "out" | "back";

/** Is this item "done" in the current mode? Outbound uses state; the trip home uses return_packed. */
export const isPacked = (it: PackingItem, mode: PackMode) => (mode === "out" ? it.state === "packed" : it.return_packed);

/** Viewers may pack their own items, or anything in their own bag. */
export function canPack(snap: TripSnapshot, it: PackingItem): boolean {
  if (canToggle(snap, it.traveler_id)) return true;
  const bag = snap.bags.find((b) => b.id === it.bag_id);
  return !!bag && canToggle(snap, bag.owner_traveler_id);
}

export async function togglePacked(store: ReturnType<typeof useTripStore>, it: PackingItem, mode: PackMode) {
  if (mode === "back") return patchRow(store, "packing", it.id, { return_packed: !it.return_packed });
  return patchRow(store, "packing", it.id, { state: it.state === "packed" ? "need" : "packed" });
}

/** The square state control: empty = need, filled check = packed, "!" in trip color = missing. */
export function StateBox({ item, mode, onToggle, disabled, size = 26 }: { item: PackingItem; mode: PackMode; onToggle: () => void; disabled?: boolean; size?: number }) {
  const t = useTranslations("packing");
  const packed = isPacked(item, mode);
  const missing = mode === "out" && item.state === "missing";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={packed}
      aria-label={`${item.title}: ${missing ? t("states.missing") : packed ? t("states.packed") : t("states.need")}`}
      className="grid size-11 shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-40"
    >
      {missing ? (
        <span style={{ width: size, height: size }} className="grid place-items-center border-[2.5px] border-trip-ink text-lg font-extrabold leading-none text-trip-ink">
          !
        </span>
      ) : packed ? (
        <span style={{ width: size, height: size }} className="grid place-items-center bg-c-packing">
          <Icon name="check" size={size * 0.62} strokeWidth={4} className="text-surface" />
        </span>
      ) : (
        <span style={{ width: size, height: size }} className="border-[2.5px] border-c-packing bg-surface" />
      )}
    </button>
  );
}

type ItemDraft = { title: string; qty: number; category: string; traveler: string; bag: string; notes: string };

export function ItemSheet({ item, onClose }: { item: PackingItem | null; onClose: () => void }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [d, setD] = useState<ItemDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const draft: ItemDraft | null =
    d ?? (item ? { title: item.title, qty: item.qty, category: item.category, traveler: item.traveler_id ?? "", bag: item.bag_id ?? "", notes: item.notes ?? "" } : null);

  function close() {
    setD(null);
    onClose();
  }

  async function save() {
    if (!item || !draft) return;
    const patch: Partial<PackingItem> = {};
    if (draft.title.trim() && draft.title.trim() !== item.title) patch.title = draft.title.trim();
    if (draft.qty !== item.qty) patch.qty = draft.qty;
    if (draft.category !== item.category) patch.category = draft.category;
    if ((draft.traveler || null) !== item.traveler_id) patch.traveler_id = draft.traveler || null;
    if ((draft.bag || null) !== item.bag_id) patch.bag_id = draft.bag || null;
    if ((draft.notes.trim() || null) !== item.notes) patch.notes = draft.notes.trim() || null;
    if (!Object.keys(patch).length) return close();
    setBusy(true);
    try {
      await patchRow(store, "packing", item.id, patch);
      close();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function setMissing(missing: boolean) {
    if (!item) return;
    await patchRow(store, "packing", item.id, { state: missing ? "missing" : "need" }).catch(() => showToast({ message: tc("errorGeneric") }));
    close();
  }

  async function remove() {
    if (!item) return;
    close();
    try {
      const undo = await softDelete(store, "packing", item.id);
      showToast({ message: t("deleted", { title: item.title }), actionLabel: tc("undo"), onAction: () => void undo() });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <Sheet open={item !== null} onClose={close} title={t("itemDetails")} closeLabel={tc("close")}>
      {item && draft ? (
        <div className="flex flex-col gap-4">
          <fieldset disabled={!canEdit} className="flex flex-col gap-4">
            <TextField label={t("itemTitle")} value={draft.title} maxLength={120} onChange={(e) => setD({ ...draft, title: e.target.value })} />
            <Stepper label={t("qty")} value={draft.qty} min={1} max={999} onChange={(qty) => setD({ ...draft, qty })} />
            <Select label={t("category")} value={draft.category} onChange={(e) => setD({ ...draft, category: e.target.value })} options={PACKING_CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label={t("forWhom")} value={draft.traveler} onChange={(e) => setD({ ...draft, traveler: e.target.value })} options={[{ value: "", label: t("shared") }, ...live(snap.travelers).map((x) => ({ value: x.id, label: x.label }))]} />
              <Select label={t("bag")} value={draft.bag} onChange={(e) => setD({ ...draft, bag: e.target.value })} options={[{ value: "", label: t("noBag") }, ...live(snap.bags).map((b) => ({ value: b.id, label: b.label }))]} />
            </div>
            <TextField label={t("notes")} value={draft.notes} maxLength={1000} onChange={(e) => setD({ ...draft, notes: e.target.value })} />
          </fieldset>
          {canPack(snap, item) ? (
            item.state === "missing" ? (
              <Button variant="secondary" onClick={() => setMissing(false)}>
                {t("notMissing")}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setMissing(true)}>
                {t("markMissing")}
              </Button>
            )
          ) : null}
          {canEdit ? (
            <>
              <Button size="lg" block loading={busy} disabled={!draft.title.trim()} onClick={save}>
                {tc("save")}
              </Button>
              <Button variant="danger" block icon={<Icon name="trash" size={18} />} onClick={remove}>
                {tc("delete")}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

const BAG_KINDS = ["suitcase", "carry_on", "backpack", "other"] as const;

export function BagSheet({ bag, open, onClose }: { bag: Bag | null; open: boolean; onClose: () => void }) {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const [label, setLabel] = useState<string | null>(null);
  const [kind, setKind] = useState<Bag["kind"] | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const cur = { label: label ?? bag?.label ?? "", kind: kind ?? bag?.kind ?? "suitcase", owner: owner ?? bag?.owner_traveler_id ?? "" };

  function close() {
    setLabel(null);
    setKind(null);
    setOwner(null);
    onClose();
  }

  async function save() {
    const values = { label: cur.label.trim(), kind: cur.kind, owner_traveler_id: cur.owner || null };
    if (!values.label) return;
    try {
      if (bag) await patchRow(store, "bags", bag.id, values);
      else await insertRow(store, "bags", { ...values, position: keyAfter(live(snap.bags).at(-1)?.position) });
      close();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  async function remove() {
    if (!bag) return;
    close();
    const undo = await softDelete(store, "bags", bag.id).catch(() => null);
    if (undo) showToast({ message: t("bagDeleted", { label: bag.label }), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <Sheet open={open} onClose={close} title={bag ? t("editBag") : t("addBag")} closeLabel={tc("close")}>
      <div className="flex flex-col gap-4">
        <TextField label={t("bagLabel")} placeholder={t("bagPlaceholder")} value={cur.label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
        <Select label={t("bagKind")} value={cur.kind} onChange={(e) => setKind(e.target.value as Bag["kind"])} options={BAG_KINDS.map((k) => ({ value: k, label: t(`bagKinds.${k}`) }))} />
        <Select label={t("bagOwner")} value={cur.owner} onChange={(e) => setOwner(e.target.value)} options={[{ value: "", label: t("shared") }, ...live(snap.travelers).map((x) => ({ value: x.id, label: x.label }))]} />
        <Button size="lg" block disabled={!cur.label.trim()} onClick={save}>
          {tc("save")}
        </Button>
        {bag ? (
          <Button variant="danger" block onClick={remove}>
            {t("deleteBag")}
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}
