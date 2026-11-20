"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/app/Avatar";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Stamp } from "@/components/ui/Stamp";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { keyAfter, keyBetween } from "@/lib/position";
import { insertRow, patchRow, softDelete } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import type { Traveler } from "../trip-data/types";

const AGES = ["infant", "child", "teen", "adult", "senior"] as const;
type Age = (typeof AGES)[number];
const YOUNG: readonly Age[] = ["infant", "child", "teen"];

type Draft = { label: string; age_group: Age; birth_year: string; interests: string };
const emptyDraft: Draft = { label: "", age_group: "adult", birth_year: "", interests: "" };
const toDraft = (t: Traveler): Draft => ({ label: t.label, age_group: t.age_group, birth_year: t.birth_year ? String(t.birth_year) : "", interests: t.interests.join(", ") });
const fromDraft = (d: Draft) => ({
  label: d.label.trim(),
  age_group: d.age_group,
  birth_year: YOUNG.includes(d.age_group) && /^\d{4}$/.test(d.birth_year) ? Number(d.birth_year) : null,
  interests: d.interests.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 12),
});

function TravelerForm({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const t = useTranslations("travelers");
  return (
    <div className="flex flex-col gap-4">
      <TextField label={t("label")} placeholder={t("labelPlaceholder")} value={draft.label} maxLength={40} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      <Select label={t("age")} value={draft.age_group} onChange={(e) => setDraft({ ...draft, age_group: e.target.value as Age })} options={AGES.map((a) => ({ value: a, label: t(`ages.${a}`) }))} />
      {YOUNG.includes(draft.age_group) ? (
        <TextField label={t("birthYear")} hint={t("birthYearHint")} inputMode="numeric" maxLength={4} value={draft.birth_year} onChange={(e) => setDraft({ ...draft, birth_year: e.target.value.replace(/\D/g, "") })} />
      ) : null}
      <TextField label={t("interests")} hint={t("interestsHint")} value={draft.interests} onChange={(e) => setDraft({ ...draft, interests: e.target.value })} />
    </div>
  );
}

export function TravelersSettings() {
  const t = useTranslations("travelers");
  const tc = useTranslations("common");
  const data = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const travelers = data.travelers.filter((x) => !x.deleted_at);
  const [editing, setEditing] = useState<Traveler | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const base = `/trips/${data.trip!.id}`;
  const memberName = (userId: string | null) => data.members.find((m) => m.user_id === userId)?.profile?.display_name;

  function open(target: Traveler | "new") {
    setDraft(target === "new" ? emptyDraft : toDraft(target));
    setEditing(target);
  }

  async function save() {
    const values = fromDraft(draft);
    if (!values.label) return;
    setBusy(true);
    try {
      if (editing === "new") {
        await insertRow(store, "travelers", { ...values, position: keyAfter(travelers.at(-1)?.position) });
      } else if (editing) {
        await patchRow(store, "travelers", editing.id, values);
      }
      setEditing(null);
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= travelers.length) return;
    // New key between the neighbours on the far side of the target slot.
    const position = dir < 0 ? keyBetween(travelers[j - 1]?.position, travelers[j].position) : keyBetween(travelers[j].position, travelers[j + 1]?.position);
    await patchRow(store, "travelers", travelers[i].id, { position }).catch(() => showToast({ message: tc("errorGeneric") }));
  }

  async function remove(tr: Traveler) {
    setEditing(null);
    try {
      const undo = await softDelete(store, "travelers", tr.id);
      showToast({ message: t("removed", { name: tr.label }), actionLabel: tc("undo"), onAction: () => void undo() });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("title")} backHref={`${base}/settings`} backLabel={tc("back")} />
      <p className="text-ink-2">{t("intro")}</p>
      <ul className="flex flex-col border-t-2 border-ink">
        {travelers.map((tr, i) => (
          <li key={tr.id} className="flex min-h-16 items-center gap-3 border-b border-hair py-2">
            <Avatar name={tr.label} color={data.trip!.theme_color} size={40} />
            <button type="button" disabled={!canEdit} onClick={() => open(tr)} className="flex flex-1 flex-col items-start text-start">
              <span className="text-lg font-bold">{tr.label}</span>
              <span className="text-sm text-ink-2">
                {t(`ages.${tr.age_group}`)}
                {tr.interests.length ? ` · ${tr.interests.join(", ")}` : ""}
              </span>
            </button>
            {tr.linked_user_id ? <Stamp tone="ink" tilt={-3}>{memberName(tr.linked_user_id) ?? t("linked")}</Stamp> : null}
            {canEdit ? (
              <span className="flex flex-col">
                <button type="button" aria-label={t("moveUp", { name: tr.label })} disabled={i === 0} onClick={() => move(i, -1)} className="grid h-7 w-11 place-items-center disabled:opacity-25">
                  <Icon name="chevron" size={18} className="rotate-90" />
                </button>
                <button type="button" aria-label={t("moveDown", { name: tr.label })} disabled={i === travelers.length - 1} onClick={() => move(i, 1)} className="grid h-7 w-11 place-items-center disabled:opacity-25">
                  <Icon name="chevron" size={18} className="-rotate-90" />
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <Button variant="secondary" icon={<Icon name="plus" strokeWidth={3} />} onClick={() => open("new")}>
          {t("add")}
        </Button>
      ) : null}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? t("add") : t("edit")} closeLabel={tc("close")}>
        <div className="flex flex-col gap-5">
          <TravelerForm draft={draft} setDraft={setDraft} />
          <Button size="lg" block loading={busy} disabled={!draft.label.trim()} onClick={save}>
            {tc("save")}
          </Button>
          {editing && editing !== "new" ? (
            <Button variant="danger" block onClick={() => remove(editing)} icon={<Icon name="trash" size={18} />}>
              {t("remove")}
            </Button>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
