"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { TextField } from "@/components/ui/TextField";
import { Ticket } from "@/components/ui/Ticket";
import { DEFAULT_TRIP_COLOR } from "@/lib/theme";
import { BUILTIN_TEMPLATES, templateCounts, type TemplatePayload } from "@/lib/templates/builtin";
import { listMyTemplates } from "../templates/api";
import type { TripProfile } from "@/lib/trip-profile";
import { useAsync } from "@/lib/use-async";
import { fetchMe } from "../me/api";
import { createTripWithProfile } from "./api";
import { cleanDestinations, DestinationsEditor } from "./DestinationsEditor";

const STEPS = 4;

type Companion = { name: string; age: string };

/** New trip in 3 short steps (PLAN 1.1): name & color → dates → destinations. Everything else later. */
export function NewTripWizard() {
  const t = useTranslations("newTrip");
  const tc = useTranslations("common");
  const tNav = useTranslations("tripNav");
  const router = useRouter();
  const me = useAsync(fetchMe, "me");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_TRIP_COLOR);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [destinations, setDestinations] = useState<TripProfile["destinations"]>([]);
  const [templateId, setTemplateId] = useState("");
  // Who's traveling (not the same as who uses the app): me, plus whoever else comes.
  const [companions, setCompanions] = useState<Companion[]>([{ name: "", age: "" }]);
  const mine = useAsync(() => listMyTemplates().catch(() => []), "my-templates");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badDates = Boolean(start && end && end < start);
  const canNext = step === 1 ? name.trim().length > 0 : step === 2 ? !badDates : true;

  const options: { id: string; name: string; payload: TemplatePayload }[] = [
    ...BUILTIN_TEMPLATES,
    ...(mine.status === "ready" ? mine.data : []).map((m) => ({ id: m.id, name: m.name, payload: m.payload })),
  ];
  const chosenTemplate = () => options.find((o) => o.id === templateId)?.payload ?? null;

  async function create() {
    if (me.status !== "ready" || !me.data) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createTripWithProfile({
        name: name.trim(),
        color,
        start: start || null,
        end: end || null,
        destinations: cleanDestinations(destinations),
        myName: me.data.profile.display_name,
        myUserId: me.data.id,
        others: companions
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name.trim(), age: c.age.trim() && Number.isFinite(Number(c.age)) ? Number(c.age) : undefined })),
        template: chosenTemplate(),
      });
      router.replace(`/trips/${id}/today`);
    } catch {
      setError(tc("errorGeneric"));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("title")} backHref="/trips" backLabel={tNav("allTrips")} />
      <main className="pb-safe mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pb-10" style={{ "--trip": color } as CSSProperties}>
        <div aria-hidden="true">
          <Ticket
            main={
              <div className="relative px-4 pb-3 pt-4">
                <span className="halftone absolute -end-8 -top-8 size-28 rounded-full opacity-50" />
                <p className={`display relative text-[3rem] ${name.trim() ? "" : "text-ink-3"}`}>{name.trim() || t("namePlaceholder")}</p>
                {start ? <p className="relative text-sm font-bold">{end ? `${start} — ${end}` : start}</p> : null}
                {cleanDestinations(destinations).length ? (
                  <p className="relative text-sm text-ink-2">{cleanDestinations(destinations).flatMap((d) => d.cities.map((c) => c.name)).join(" · ")}</p>
                ) : null}
              </div>
            }
            stub={<div className="h-4" />}
          />
        </div>
        <p className="text-sm font-extrabold">{t("stepOf", { step, total: STEPS })}</p>

        {step === 1 ? (
          <div className="flex flex-col gap-6">
            <TextField label={t("nameLabel")} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
            <ColorPicker label={t("colorLabel")} value={color} onChange={setColor} />
          </div>
        ) : step === 2 ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField label={t("startLabel")} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <TextField label={t("endLabel")} type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} error={badDates ? t("badDates") : null} />
            </div>
            <p className="text-sm text-ink-2">{t("datesHint")}</p>
          </div>
        ) : step === 4 ? (
          <div className="flex flex-col gap-3">
            <p className="text-ink-2">{t("travelersHint")}</p>
            <p className="flex min-h-12 items-center gap-2 border-2 border-ink bg-surface px-3 font-bold">
              {me.status === "ready" && me.data ? me.data.profile.display_name : ""}
              <span className="text-sm font-normal text-ink-2">{t("thatsMe")}</span>
            </p>
            {companions.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_6rem] gap-2">
                <TextField
                  label={t("companionName", { n: i + 2 })}
                  placeholder={t("companionPlaceholder")}
                  value={c.name}
                  maxLength={40}
                  onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)).concat(i === companions.length - 1 && e.target.value && companions.length < 15 ? [{ name: "", age: "" }] : []))}
                />
                <TextField
                  label={t("companionAge")}
                  inputMode="numeric"
                  placeholder={t("agePlaceholder")}
                  value={c.age}
                  maxLength={3}
                  onChange={(e) => setCompanions(companions.map((x, j) => (j === i ? { ...x, age: e.target.value.replace(/\D/g, "") } : x)))}
                />
              </div>
            ))}
            <p className="text-sm text-ink-2">{t("travelersLater")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-ink-2">{t("destinationsHint")}</p>
            <DestinationsEditor value={destinations} onChange={setDestinations} />
            <fieldset className="mt-4 flex flex-col gap-2">
              <legend className="mb-1 text-sm font-extrabold">{t("startFrom")}</legend>
              {[{ id: "", name: t("startEmpty"), payload: null as TemplatePayload | null }, ...options].map((o) => {
                const c = o.payload ? templateCounts(o.payload) : null;
                return (
                  <label key={o.id || "empty"} className={`flex min-h-14 cursor-pointer items-center gap-3 border-2 px-3 py-2 ${templateId === o.id ? "border-ink bg-surface" : "border-hair"}`}>
                    <input type="radio" name="template" checked={templateId === o.id} onChange={() => setTemplateId(o.id)} className="size-5 accent-[var(--trip)]" />
                    <span className="flex flex-col">
                      <span className="font-bold">{o.name}</span>
                      {c ? <span className="text-sm text-ink-2">{t("templateCounts", c)}</span> : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </div>
        )}

        {error ? (
          <p role="alert" className="font-bold text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3">
          {step > 1 ? (
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(step - 1)} disabled={busy}>
              {tc("back")}
            </Button>
          ) : null}
          {step < STEPS ? (
            <Button size="lg" className="flex-[2]" onClick={() => setStep(step + 1)} disabled={!canNext}>
              {tc("next")}
            </Button>
          ) : (
            <Button size="lg" className="flex-[2]" onClick={create} loading={busy} disabled={me.status !== "ready"}>
              {busy ? t("creating") : t("create")}
            </Button>
          )}
        </div>
      </main>
    </>
  );
}
