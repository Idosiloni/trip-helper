"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Chips } from "@/components/ui/Chips";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { BUDGETS, FOOD, PACES, parseTripProfile, TRANSPORT, type TripProfile } from "@/lib/trip-profile";
import { patchTrip } from "../trip-data/mutations";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { patchProfile } from "./api";
import { cleanDestinations, DestinationsEditor } from "./DestinationsEditor";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t-2 border-ink pt-4">
      <h3 className="text-lg font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

/** Trip profile (SPEC 6.1): the context every prompt is built from. Each part saves on its own. */
export function ProfileSettings() {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const data = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const trip = data.trip!;
  const profile = parseTripProfile(trip.profile);

  const [name, setName] = useState(trip.name);
  const [start, setStart] = useState(trip.start_date ?? "");
  const [end, setEnd] = useState(trip.end_date ?? "");
  const [destinations, setDestinations] = useState(profile.destinations);
  const [destDirty, setDestDirty] = useState(false);
  const [luggage, setLuggage] = useState(profile.luggage);
  const luggageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(luggageTimer.current), []);

  async function save(fn: () => Promise<unknown>) {
    try {
      await fn();
      showToast({ message: tc("saved"), duration: 1500 });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
  }
  const saveProfile = (patch: Partial<TripProfile>) =>
    save(async () => {
      const merged = await patchProfile(trip.id, patch);
      store.setTripLocal({ profile: merged });
    });

  const badDates = Boolean(start && end && end < start);
  const base = `/trips/${trip.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SubHeader title={t("title")} backHref={`${base}/settings`} backLabel={tc("back")} />
      {!canEdit ? <p className="border-2 border-dashed border-ink p-3 text-sm">{t("readOnly")}</p> : null}
      <fieldset disabled={!canEdit} className="flex flex-col gap-8 disabled:opacity-70">
        <Section title={t("basics")}>
          <TextField label={t("name")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name.trim() !== trip.name && save(() => patchTrip(store, { name: name.trim() }))} />
          <ColorPicker label={t("color")} value={trip.theme_color} onChange={(c) => save(() => patchTrip(store, { theme_color: c }))} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t("start")} type="date" value={start} onChange={(e) => setStart(e.target.value)} onBlur={() => !badDates && start !== (trip.start_date ?? "") && save(() => patchTrip(store, { start_date: start || null }))} />
            <TextField
              label={t("end")}
              type="date"
              value={end}
              min={start || undefined}
              error={badDates ? t("badDates") : null}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={() => !badDates && end !== (trip.end_date ?? "") && save(() => patchTrip(store, { end_date: end || null }))}
            />
          </div>
        </Section>

        <Section title={t("destinations")}>
          <DestinationsEditor
            value={destinations}
            onChange={(v) => {
              setDestinations(v);
              setDestDirty(true);
            }}
          />
          {destDirty ? (
            <Button
              onClick={async () => {
                await saveProfile({ destinations: cleanDestinations(destinations) });
                setDestDirty(false);
              }}
            >
              {t("saveDestinations")}
            </Button>
          ) : null}
        </Section>

        <Section title={t("style")}>
          <Segmented
            label={t("pace")}
            value={profile.style.pace ?? "balanced"}
            options={PACES.map((p) => ({ value: p, label: t(`paces.${p}`) }))}
            onChange={(pace) => saveProfile({ style: { ...profile.style, pace } })}
          />
          <Segmented
            label={t("budget")}
            value={profile.style.budget ?? "mid"}
            options={BUDGETS.map((b) => ({ value: b, label: t(`budgets.${b}`) }))}
            onChange={(budget) => saveProfile({ style: { ...profile.style, budget } })}
          />
          <Chips label={t("food")} value={profile.style.food} options={FOOD.map((f) => ({ value: f, label: t(`foods.${f}`) }))} onChange={(food) => saveProfile({ style: { ...profile.style, food } })} />
          <Chips
            label={t("transport")}
            value={profile.style.transport}
            options={TRANSPORT.map((x) => ({ value: x, label: t(`transports.${x}`) }))}
            onChange={(transport) => saveProfile({ style: { ...profile.style, transport } })}
          />
        </Section>

        <Section title={t("luggage")}>
          {(["suitcases", "carryOns"] as const).map((k) => (
            <Stepper
              key={k}
              label={t(k)}
              value={luggage[k]}
              max={20}
              onChange={(v) => {
                const next = { ...luggage, [k]: v };
                setLuggage(next);
                clearTimeout(luggageTimer.current);
                luggageTimer.current = setTimeout(() => void saveProfile({ luggage: next }), 700);
              }}
            />
          ))}
        </Section>

        <Section title={t("prompts")}>
          <Segmented
            label={t("answerLanguage")}
            value={profile.answerLanguage}
            options={[
              { value: "he", label: t("hebrew") },
              { value: "en", label: t("english") },
            ]}
            onChange={(answerLanguage) => saveProfile({ answerLanguage })}
          />
          <Switch label={t("namesInPrompts")} hint={t("namesInPromptsHint")} checked={profile.namesInPrompts} onChange={(namesInPrompts) => saveProfile({ namesInPrompts })} />
        </Section>
      </fieldset>
    </div>
  );
}
