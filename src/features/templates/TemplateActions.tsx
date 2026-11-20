"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { useTripData } from "../trip-data/TripDataProvider";
import { duplicateTrip, saveTripAsTemplate } from "./api";

function SaveTemplateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("templates");
  const tc = useTranslations("common");
  const trip = useTripData().trip!;
  const [name, setName] = useState(trip.name);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await saveTripAsTemplate(trip.id, name.trim());
      showToast({ message: t("saved") });
      onClose();
    } catch (e) {
      console.error("save template failed", e);
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }
  return (
    <Sheet open={open} onClose={onClose} title={t("saveTitle")} closeLabel={tc("close")}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-2">{t("saveBody")}</p>
        <TextField label={t("nameLabel")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Button size="lg" block loading={busy} disabled={!name.trim()} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </Sheet>
  );
}

function DuplicateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("templates");
  const tn = useTranslations("newTrip");
  const tc = useTranslations("common");
  const router = useRouter();
  const trip = useTripData().trip!;
  const [name, setName] = useState(t("copyName", { name: trip.name }).slice(0, 60));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const badDates = Boolean(start && end && end < start);
  async function go() {
    setBusy(true);
    try {
      const id = await duplicateTrip(trip.id, name.trim(), start || null, end || null);
      showToast({ message: t("duplicated") });
      router.push(`/trips/${id}/today`);
    } catch (e) {
      console.error("duplicate trip failed", e);
      showToast({ message: tc("errorGeneric") });
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t("duplicateTitle")} closeLabel={tc("close")}>
      <div className="flex flex-col gap-4">
        <p className="text-ink-2">{t("duplicateBody")}</p>
        <TextField label={tn("nameLabel")} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={tn("startLabel")} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <TextField label={tn("endLabel")} type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} error={badDates ? tn("badDates") : null} />
        </div>
        <Button size="lg" block loading={busy} disabled={!name.trim() || badDates} onClick={go}>
          {t("duplicate")}
        </Button>
      </div>
    </Sheet>
  );
}

/** "Next time" actions: save this trip's lists as a template, or copy the whole trip. */
export function TemplateActions() {
  const t = useTranslations("templates");
  const [open, setOpen] = useState<"save" | "dup" | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" icon={<Icon name="lists" size={18} />} onClick={() => setOpen("save")}>
        {t("save")}
      </Button>
      <Button variant="secondary" icon={<Icon name="copy" size={18} />} onClick={() => setOpen("dup")}>
        {t("duplicate")}
      </Button>
      <SaveTemplateSheet key={open === "save" ? "s-open" : "s"} open={open === "save"} onClose={() => setOpen(null)} />
      <DuplicateSheet key={open === "dup" ? "d-open" : "d"} open={open === "dup"} onClose={() => setOpen(null)} />
    </div>
  );
}
