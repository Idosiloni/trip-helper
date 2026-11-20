"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { findDuplicates } from "@/lib/import/dedupe";
import { readKmlFile, type KmlPoint } from "@/lib/import/kml";
import { keysAfter, lastKey } from "@/lib/position";
import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { placeCategoryKey } from "@/lib/tripdata/schemas";
import { live } from "../lists/helpers";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";

type Row = KmlPoint & { key: number; include: boolean; duplicate: boolean };

/** Google My Maps → places, with confirmed pins (SPEC 8.3). The file never leaves the device. */
export function KmlImportScreen() {
  const t = useTranslations("kml");
  const tc = useTranslations("common");
  const tpl = useTranslations("places");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const router = useRouter();
  const base = `/trips/${snap.trip!.id}`;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setRows(null);
    setFileName(file.name);
    try {
      const points = await readKmlFile(file);
      if (!points.length) return setError(t("none"));
      const dups = findDuplicates(points.map((p) => p.name), live(snap.places).map((p) => p.name));
      setRows(points.map((p, i) => ({ ...p, key: i, duplicate: Boolean(dups[i].duplicateOf || dups[i].repeatInBatch), include: !dups[i].duplicateOf && !dups[i].repeatInBatch })));
    } catch {
      setError(t("failed"));
    }
  }

  async function commit() {
    const chosen = (rows ?? []).filter((r) => r.include);
    if (!chosen.length) return;
    setBusy(true);
    const positions = keysAfter(lastKey(snap.places), chosen.length);
    const items = chosen.map((r, i) => ({
      name: r.name,
      category: r.layer ? placeCategoryKey(r.layer) : "attraction",
      notes: r.description,
      lat: r.lat,
      lng: r.lng,
      geocode_label: r.layer ? `My Maps · ${r.layer}`.slice(0, 300) : "My Maps",
      position: positions[i],
    }));
    const { data, error: err } = await supabase().rpc("commit_import", {
      p_trip_id: snap.trip!.id,
      p_kind: "places",
      p_items: items as Json,
      p_raw_text: fileName.slice(0, 200),
      p_prompt_id: "kml",
      p_prompt_version: 0,
      p_source: "google",
      p_source_label: "Google My Maps",
    });
    if (err) {
      setBusy(false);
      showToast({ message: tc("errorGeneric") });
      return;
    }
    await store.load();
    showToast({ message: t("added", { n: data ?? chosen.length }) });
    router.push(`${base}/places`);
  }

  const n = rows?.filter((r) => r.include).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("title")} backHref={`${base}/places`} backLabel={tc("back")} />
      {!canEdit ? (
        <p>{tpl("viewerCantConfirm")}</p>
      ) : (
        <>
          <p className="text-ink-2">{t("how")}</p>
          <label className="flex min-h-14 cursor-pointer items-center justify-center border-2 border-dashed border-ink bg-surface px-4 text-center font-extrabold active:bg-surface-2">
            {fileName || t("choose")}
            <input type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
          </label>
          {error ? (
            <p role="alert" className="font-bold">
              {error}
            </p>
          ) : null}
          {rows ? (
            <>
              <p className="font-extrabold">{t("found", { n: rows.length })}</p>
              <ul className="flex flex-col border-t-2 border-ink">
                {rows.map((r) => (
                  <li key={r.key}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-hair py-2">
                      <input type="checkbox" checked={r.include} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, include: e.target.checked } : x)))} className="size-6 shrink-0 accent-[var(--ink)]" />
                      <span className="flex flex-1 flex-col">
                        <span className="font-bold">{r.name}</span>
                        <span className="text-xs text-ink-2">
                          {[r.layer, r.duplicate ? t("duplicate") : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button size="lg" block loading={busy} disabled={!n} onClick={commit}>
                {t("import", { n })}
              </Button>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
