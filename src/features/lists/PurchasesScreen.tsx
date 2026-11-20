"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { keysAfter, lastKey } from "@/lib/position";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Purchase } from "../trip-data/types";
import { live } from "./helpers";
import { ListTabs } from "./ListTabs";

type Draft = { title: string; forWhom: string; budget: string; placeId: string; whereText: string; link: string; notes: string };

const toDraft = (p: Purchase | null): Draft => ({
  title: p?.title ?? "",
  forWhom: p?.for_whom ?? "",
  budget: p?.budget ?? "",
  placeId: p?.place_id ?? "",
  whereText: p?.where_text ?? "",
  link: p?.link ?? "",
  notes: p?.notes ?? "",
});

function PurchaseSheet({ item, open, onClose }: { item: Purchase | null; open: boolean; onClose: () => void }) {
  const t = useTranslations("purchases");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const d = draft ?? toDraft(item);
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const linkOk = !d.link.trim() || /^https?:\/\/\S+$/i.test(d.link.trim());
  // Shopping places first: that's where gifts are usually bought.
  const places = live(snap.places).sort((a, b) => Number(b.category === "shopping") - Number(a.category === "shopping"));

  function close() {
    setDraft(null);
    onClose();
  }

  async function save() {
    if (!d.title.trim() || !linkOk) return;
    const values = {
      title: d.title.trim(),
      for_whom: d.forWhom.trim() || null,
      budget: d.budget.trim() || null,
      place_id: d.placeId || null,
      where_text: d.whereText.trim() || null,
      link: d.link.trim() || null,
      notes: d.notes.trim() || null,
    };
    setBusy(true);
    try {
      if (item) {
        // Only the fields that changed are sent (SPEC §11).
        const before = toDraft(item);
        const patch = Object.fromEntries(
          Object.entries(values).filter(([k]) => {
            const map: Record<string, keyof Draft> = { title: "title", for_whom: "forWhom", budget: "budget", place_id: "placeId", where_text: "whereText", link: "link", notes: "notes" };
            return (before[map[k]] || null) !== (values as Record<string, string | null>)[k];
          }),
        );
        if (Object.keys(patch).length) await patchRow(store, "purchases", item.id, patch);
      } else {
        const [position] = keysAfter(lastKey(live(snap.purchases)), 1);
        await insertRow(store, "purchases", { ...values, position });
      }
      close();
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!item) return;
    close();
    const undo = await softDelete(store, "purchases", item.id).catch(() => null);
    if (undo) showToast({ message: t("deleted"), actionLabel: tc("undo"), onAction: () => void undo() });
  }

  return (
    <Sheet open={open} onClose={close} title={item ? t("edit") : t("add")} closeLabel={tc("close")}>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <TextField label={t("name")} value={d.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("forWhom")} placeholder={t("forWhomHint")} value={d.forWhom} maxLength={60} onChange={(e) => set({ forWhom: e.target.value })} />
          <TextField label={t("budget")} placeholder={t("budgetHint")} value={d.budget} maxLength={40} onChange={(e) => set({ budget: e.target.value })} />
        </div>
        <fieldset className="flex flex-col gap-2 border-t border-hair pt-3">
          <legend className="text-sm font-extrabold">{t("where")}</legend>
          <Select label={t("wherePlace")} value={d.placeId} onChange={(e) => set({ placeId: e.target.value })} options={[{ value: "", label: tc("none") }, ...places.map((p) => ({ value: p.id, label: p.name }))]} />
          <TextField label={t("whereText")} value={d.whereText} maxLength={120} onChange={(e) => set({ whereText: e.target.value })} />
        </fieldset>
        <TextField label={t("link")} type="url" dir="ltr" inputMode="url" placeholder="https://" value={d.link} onChange={(e) => set({ link: e.target.value })} error={linkOk ? null : tc("errorGeneric")} />
        <TextField label={t("notes")} value={d.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />
        {canEdit ? (
          <>
            <Button size="lg" block loading={busy} disabled={!d.title.trim() || !linkOk} onClick={save}>
              {tc("save")}
            </Button>
            {item ? (
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

function Row({ p, onOpen }: { p: Purchase; onOpen: () => void }) {
  const t = useTranslations("purchases");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const place = p.place_id ? snap.places.find((x) => x.id === p.place_id) : null;
  const buyer = p.bought_by ? snap.members.find((m) => m.user_id === p.bought_by)?.profile?.display_name : null;
  const detail = [p.for_whom ? t("for", { name: p.for_whom }) : null, p.budget, place?.name ?? p.where_text, p.bought && buyer ? t("boughtBy", { name: buyer }) : null]
    .filter(Boolean)
    .join(" · ");

  async function toggle() {
    try {
      await patchRow(store, "purchases", p.id, { bought: !p.bought });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-hair">
      <input type="checkbox" checked={p.bought} onChange={toggle} aria-label={`${p.title}: ${t("bought")}`} className="size-7 shrink-0 accent-[var(--c-purchases)]" />
      <button type="button" onClick={onOpen} className="flex min-h-16 flex-1 flex-col justify-center py-2 text-start">
        <span className={`text-[17px] font-bold ${p.bought ? "text-ink-3 line-through" : ""}`}>{p.title}</span>
        {detail ? <span className="text-xs text-ink-2">{detail}</span> : null}
      </button>
    </li>
  );
}

export function PurchasesScreen() {
  const t = useTranslations("purchases");
  const snap = useTripData();
  const canEdit = useCanEdit();
  const [open, setOpen] = useState<Purchase | "new" | null>(null);
  const items = live(snap.purchases);
  const toBuy = items.filter((p) => !p.bought);
  const bought = items.filter((p) => p.bought);

  return (
    <div className="flex flex-col">
      <ListTabs tripId={snap.trip!.id} />
      {items.length === 0 ? (
        <EmptyState icon="bag" title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-2 tabular-nums">{t("progress", { done: bought.length, total: items.length })}</p>
          {toBuy.length ? (
            <section aria-label={t("toBuy")}>
              <ul className="flex flex-col border-t-2 border-ink">
                {toBuy.map((p) => (
                  <Row key={p.id} p={p} onOpen={() => setOpen(p)} />
                ))}
              </ul>
            </section>
          ) : null}
          {bought.length ? (
            <section className="mt-6" aria-labelledby="bought-title">
              <h2 id="bought-title" className="mb-1 text-sm font-extrabold text-ink-2">
                {t("bought")}
              </h2>
              <ul className="flex flex-col border-t-2 border-ink">
                {bought.map((p) => (
                  <Row key={p.id} p={p} onOpen={() => setOpen(p)} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      {canEdit ? (
        <Button variant="secondary" className="mt-4" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => setOpen("new")}>
          {t("add")}
        </Button>
      ) : null}
      <PurchaseSheet key={open === "new" ? "new" : (open?.id ?? "closed")} item={open && open !== "new" ? open : null} open={open !== null} onClose={() => setOpen(null)} />
    </div>
  );
}
