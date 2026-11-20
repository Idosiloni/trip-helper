"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { findDuplicates } from "@/lib/import/dedupe";
import { guessCategory, nearestCity, type GmapsList, type GmapsListPlace } from "@/lib/import/gmaps-list";
import { keysAfter, lastKey } from "@/lib/position";
import { supabase } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { geocodeCity } from "@/lib/weather";
import { live } from "../lists/helpers";
import { useCanEdit, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { profileCities } from "./helpers";

type Row = GmapsListPlace & { key: number; include: boolean; duplicate: boolean; city: string | null };

/** "Paste a Google Maps list link" → places with exact pins, each filed under the nearest trip city. */
export function GmapsListImportScreen() {
  const t = useTranslations("gmaps");
  const tc = useTranslations("common");
  const tpl = useTranslations("places");
  const snap = useTripData();
  const store = useTripStore();
  const canEdit = useCanEdit();
  const router = useRouter();
  const base = `/trips/${snap.trip!.id}`;
  const [link, setLink] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pasteFromClipboard() {
    try {
      setLink(await navigator.clipboard.readText());
    } catch {
      showToast({ message: t("clipboardBlocked") });
    }
  }

  async function fetchList() {
    setError(null);
    setRows(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/gmaps-list?url=${encodeURIComponent(link.trim())}`);
      const json = (await res.json().catch(() => ({}))) as Partial<GmapsList> & { error?: string };
      if (!res.ok || !json.places) {
        const code = json.error === "not_gmaps" || json.error === "not_list" || json.error === "empty" ? json.error : "failed";
        setError(t(`errors.${code}`));
        return;
      }
      // File each place under the nearest city of the trip (cities a long way off stay unfiled).
      const names = profileCities(snap);
      const located = (await Promise.all(names.map(async (name) => ({ name, at: await geocodeCity(name).catch(() => null) }))))
        .filter((c): c is { name: string; at: { lat: number; lng: number } } => Boolean(c.at))
        .map((c) => ({ name: c.name, ...c.at }));
      const dups = findDuplicates(json.places.map((p) => p.name), live(snap.places).map((p) => p.name));
      setTitle(json.title ?? null);
      setRows(
        json.places.map((p, i) => {
          const duplicate = Boolean(dups[i].duplicateOf || dups[i].repeatInBatch);
          return { ...p, key: i, duplicate, include: !duplicate, city: nearestCity(p, located) };
        }),
      );
    } catch {
      setError(t("errors.failed"));
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    const chosen = (rows ?? []).filter((r) => r.include);
    if (!chosen.length) return;
    setBusy(true);
    const positions = keysAfter(lastKey(snap.places), chosen.length);
    const items = chosen.map((r, i) => ({
      name: r.name,
      category: guessCategory(`${r.name} ${r.note ?? ""}`),
      city: r.city ?? "",
      notes: r.note ?? "",
      lat: r.lat,
      lng: r.lng,
      maps_url: r.mapsUrl ?? "",
      geocode_label: (r.address ?? "Google Maps").slice(0, 300),
      position: positions[i],
    }));
    // One import holds up to 300 places; big lists go up in parts.
    let added = 0;
    for (let i = 0; i < items.length; i += 250) {
      const { data, error: err } = await supabase().rpc("commit_import", {
        p_trip_id: snap.trip!.id,
        p_kind: "places",
        p_items: items.slice(i, i + 250) as Json,
        p_raw_text: link.trim().slice(0, 300),
        p_prompt_id: "gmaps-list",
        p_prompt_version: 0,
        p_source: "google",
        p_source_label: title ? `Google Maps · ${title}`.slice(0, 120) : "Google Maps",
      });
      if (err) {
        setBusy(false);
        await store.load();
        showToast({ message: added ? t("partial", { n: added }) : tc("errorGeneric") });
        return;
      }
      added += data ?? 0;
    }
    await store.load();
    showToast({ message: t("added", { n: added }) });
    router.push(`${base}/places`);
  }

  const n = rows?.filter((r) => r.include).length ?? 0;
  const cityCount = new Map<string, number>();
  for (const r of rows ?? []) if (r.include) cityCount.set(r.city ?? t("noCity"), (cityCount.get(r.city ?? t("noCity")) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <SubHeader title={t("title")} backHref={`${base}/places`} backLabel={tc("back")} />
      {!canEdit ? (
        <p>{tpl("viewerCantConfirm")}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-1 text-[15px]">
            <li>
              <b>1.</b> {t("step1")}
            </li>
            <li>
              <b>2.</b> {t("step2")}
            </li>
            <li>
              <b>3.</b> {t("step3")}
            </li>
          </ol>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="gmaps-link" className="text-sm font-bold">
                {t("linkLabel")}
              </label>
              <button type="button" onClick={pasteFromClipboard} className="flex min-h-11 items-center gap-1.5 text-sm font-bold underline underline-offset-4">
                <Icon name="paste" size={16} />
                {t("fromClipboard")}
              </button>
            </div>
            <input
              id="gmaps-link"
              type="url"
              dir="ltr"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              className="min-h-12 w-full border-2 border-ink bg-surface px-3 text-base"
            />
          </div>
          <Button size="lg" block loading={loading} disabled={!link.trim()} icon={<Icon name="pin" size={18} />} onClick={() => void fetchList()}>
            {t("fetch")}
          </Button>
          {error ? (
            <p role="alert" className="border-2 border-ink bg-surface-2 p-3 font-bold">
              {error}
            </p>
          ) : null}
          {rows ? (
            <>
              <div className="flex flex-col gap-1">
                <p className="font-extrabold">
                  {title ? `${title} · ` : ""}
                  {t("found", { n: rows.length })}
                </p>
                {rows.length >= 500 ? <p className="text-sm font-bold">{t("capped")}</p> : null}
                <p className="text-sm text-ink-2">
                  {[...cityCount.entries()].map(([c, k]) => `${c}: ${k}`).join(" · ")}
                </p>
              </div>
              <ul className="flex flex-col border-t-2 border-ink">
                {rows.map((r) => (
                  <li key={r.key}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-hair py-2">
                      <input type="checkbox" checked={r.include} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, include: e.target.checked } : x)))} className="size-6 shrink-0 accent-[var(--ink)]" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-bold">{r.name}</span>
                        <span className="truncate text-xs text-ink-2">{[r.city ?? t("noCity"), r.duplicate ? t("duplicate") : null, r.note].filter(Boolean).join(" · ")}</span>
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
