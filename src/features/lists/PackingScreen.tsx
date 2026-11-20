"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { Stamp } from "@/components/ui/Stamp";
import { showToast } from "@/components/ui/Toast";
import { keysAfter } from "@/lib/position";
import { parsePackingQuickAdd } from "@/lib/quick-add";
import { categoryKey, PACKING_CATEGORIES } from "@/lib/tripdata/schemas";
import { insertRow, patchRow } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Bag, PackingItem } from "../trip-data/types";
import { live, travelerLabel } from "./helpers";
import { ListTabs } from "./ListTabs";
import { BagSheet, canPack, isPacked, ItemSheet, StateBox, togglePacked, type PackMode } from "./packing-shared";

type View = "category" | "traveler" | "bag";

/** A luggage tag: notched start edge, label and progress; opens pack mode. */
function BagTag({ href, label, done, total, onEdit, editLabel }: { href: string; label: string; done: number; total: number; onEdit?: () => void; editLabel: string }) {
  const t = useTranslations("packing");
  return (
    <div className="flex min-w-[9.5rem] items-stretch border-2 border-ink bg-surface">
      <Link href={href} className="flex flex-1 items-center gap-2 py-1.5 pe-2 ps-3 active:bg-surface-2">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border-2 border-ink" />
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold">{label}</span>
          <span className="text-xs text-ink-2">{t("bagProgress", { done, total })}</span>
        </span>
      </Link>
      {onEdit ? (
        <button type="button" onClick={onEdit} aria-label={editLabel} className="grid w-9 place-items-center border-s border-hair">
          <Icon name="edit" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export function PackingScreen() {
  const t = useTranslations("packing");
  const tc = useTranslations("common");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const params = useSearchParams();
  const [view, setView] = useState<View>("category");
  const [mode, setMode] = useState<PackMode>("out");
  const [onlyMissing, setOnlyMissing] = useState(params.get("filter") === "missing");
  const [openItem, setOpenItem] = useState<PackingItem | null>(null);
  const [bagSheet, setBagSheet] = useState<{ open: boolean; bag: Bag | null }>({ open: false, bag: null });
  const [newTitle, setNewTitle] = useState("");
  const trip = snap.trip!;
  const base = `/trips/${trip.id}/lists/packing`;

  const items = live(snap.packing);
  const bags = live(snap.bags);
  const bagOf = (it: PackingItem) => bags.find((b) => b.id === it.bag_id) ?? null;
  const done = items.filter((it) => isPacked(it, mode)).length;
  const missing = items.filter((it) => it.state === "missing").length;
  const shown = onlyMissing ? items.filter((it) => it.state === "missing") : items;

  type Group = { key: string; title: string; items: PackingItem[] };
  let groups: Group[];
  if (view === "category") {
    groups = PACKING_CATEGORIES.map((c) => ({ key: c, title: t(`categories.${c}`), items: shown.filter((it) => categoryKey(it.category) === c || it.category === c) }));
  } else if (view === "traveler") {
    groups = [
      { key: "shared", title: t("shared"), items: shown.filter((it) => !it.traveler_id) },
      ...live(snap.travelers).map((tr) => ({ key: tr.id, title: tr.label, items: shown.filter((it) => it.traveler_id === tr.id) })),
    ];
  } else {
    groups = [...bags.map((b) => ({ key: b.id, title: b.label, items: shown.filter((it) => it.bag_id === b.id) })), { key: "none", title: t("noBag"), items: shown.filter((it) => !bagOf(it)) }];
  }
  groups = groups.filter((g) => g.items.length > 0);

  async function add(e: FormEvent) {
    e.preventDefault();
    const parsed = parsePackingQuickAdd(newTitle);
    if (!parsed.length) return;
    setNewTitle("");
    const positions = keysAfter(items.at(-1)?.position, parsed.length);
    try {
      for (const [i, x] of parsed.entries()) await insertRow(store, "packing", { title: x.title, qty: x.qty, category: x.category, position: positions[i] });
      if (parsed.length > 1) showToast({ message: t("addedMany", { n: parsed.length }) });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  async function resetReturn() {
    if (!window.confirm(t("resetReturnConfirm"))) return;
    const packedBack = items.filter((it) => it.return_packed);
    await Promise.all(packedBack.map((it) => patchRow(store, "packing", it.id, { return_packed: false }).catch(() => null)));
  }

  return (
    <div className="flex flex-col">
      <ListTabs tripId={trip.id} />

      <div className="mb-3 flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="display print-offset text-[3.5rem] leading-[0.8] tabular-nums">
            {done}/{items.length}
          </span>
          <span className="font-bold">{mode === "out" ? t("packedLabel") : t("packedBackLabel")}</span>
        </p>
        {missing ? (
          <button type="button" aria-pressed={onlyMissing} onClick={() => setOnlyMissing(!onlyMissing)} className="min-h-11">
            <Stamp tone={onlyMissing ? "ink" : "trip"}>{onlyMissing ? t("showAll") : t("missingCount", { n: missing })}</Stamp>
          </button>
        ) : null}
      </div>

      <Segmented<PackMode>
        label={t("direction")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "out", label: t("outbound") },
          { value: "back", label: t("homebound") },
        ]}
      />

      <div className="mt-4 flex flex-col gap-2">
        <h3 className="text-sm font-extrabold">{t("bags")}</h3>
        <div className="flex flex-wrap gap-2">
          {bags.map((b) => {
            const inBag = items.filter((it) => it.bag_id === b.id);
            return (
              <BagTag
                key={b.id}
                href={`${base}/pack/${b.id}?mode=${mode}`}
                label={b.label}
                done={inBag.filter((it) => isPacked(it, mode)).length}
                total={inBag.length}
                editLabel={t("editBagNamed", { label: b.label })}
                onEdit={canEdit ? () => setBagSheet({ open: true, bag: b }) : undefined}
              />
            );
          })}
          {canEdit ? (
            <button type="button" onClick={() => setBagSheet({ open: true, bag: null })} className="flex min-h-12 items-center gap-1.5 border-2 border-dashed border-ink px-3 text-sm font-bold">
              <Icon name="plus" size={16} strokeWidth={3} />
              {t("addBag")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <Segmented<View>
          label={t("groupBy")}
          value={view}
          onChange={setView}
          options={[
            { value: "category", label: t("views.category") },
            { value: "traveler", label: t("views.traveler") },
            { value: "bag", label: t("views.bag") },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon="bag" title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
          {groups.map((g) => (
            <section key={g.key} className="border-2 border-ink bg-surface shadow-[3px_3px_0_0_var(--trip-tint)]">
              {/* Packing reads as luggage tags: a panel per group with a fill bar, unlike the task list. */}
              <h3 className="flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-2 text-sm font-extrabold">
                <span className="flex items-center gap-2">
                  <Icon name="bag" size={16} className="text-c-packing" />
                  {g.title}
                </span>
                <span className="tabular-nums text-ink-2">
                  {g.items.filter((it) => isPacked(it, mode)).length}/{g.items.length}
                </span>
              </h3>
              <div aria-hidden="true" className="h-1.5 bg-surface-2">
                <div className="h-full bg-c-packing" style={{ width: `${g.items.length ? (g.items.filter((it) => isPacked(it, mode)).length / g.items.length) * 100 : 0}%` }} />
              </div>
              <ul className="px-1">
                {g.items.map((it) => {
                  const who = view !== "traveler" ? travelerLabel(snap, it.traveler_id) : null;
                  const bag = view !== "bag" ? bagOf(it)?.label : null;
                  const meta = [who, bag].filter(Boolean).join(" · ");
                  return (
                    <li key={it.id} className="flex min-h-14 items-center gap-1 border-b border-hair last:border-b-0">
                      <StateBox item={it} mode={mode} disabled={!canPack(snap, it)} onToggle={() => void togglePacked(store, it, mode).catch(() => showToast({ message: tc("errorGeneric") }))} />
                      <button type="button" onClick={() => setOpenItem(it)} className="flex min-h-14 flex-1 flex-col items-start justify-center py-1.5 text-start">
                        <span className={`text-[17px] ${isPacked(it, mode) ? "text-ink-3 line-through" : ""}`}>
                          {it.title}
                          {it.qty > 1 ? <span className="font-bold"> ×{it.qty}</span> : null}
                        </span>
                        {meta ? <span className="text-xs text-ink-2">{meta}</span> : null}
                      </button>
                      {it.state === "missing" && mode === "out" ? <Stamp tilt={3}>{t("toBuy")}</Stamp> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canEdit ? (
        <form onSubmit={add} className="mt-6 flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t("addPlaceholder")}
            aria-label={t("addPlaceholder")}
            maxLength={1000}
            className="min-h-12 flex-1 border-2 border-ink bg-surface px-3 text-base placeholder:text-ink-3"
          />
          <button type="submit" aria-label={tc("add")} className="grid size-12 place-items-center bg-ink text-on-ink">
            <Icon name="plus" strokeWidth={3} />
          </button>
        </form>
      ) : null}
      {canEdit ? <p className="mt-1.5 text-xs text-ink-2">{t("quickAddHint")}</p> : null}

      {mode === "back" && canEdit && items.some((it) => it.return_packed) ? (
        <div className="mt-4">
          <Button variant="ghost" onClick={resetReturn}>
            {t("resetReturn")}
          </Button>
        </div>
      ) : null}

      <ItemSheet item={openItem ? (snap.packing.find((x) => x.id === openItem.id) ?? null) : null} onClose={() => setOpenItem(null)} />
      <BagSheet bag={bagSheet.bag} open={bagSheet.open} onClose={() => setBagSheet({ open: false, bag: null })} />
    </div>
  );
}
