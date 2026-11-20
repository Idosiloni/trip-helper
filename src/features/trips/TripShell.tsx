"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { CenteredSpinner } from "@/components/app/CenteredSpinner";
import { ErrorBox } from "@/components/app/ErrorBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { TripDataProvider, useTripData, useTripStore } from "../trip-data/TripDataProvider";
import { PromptSheet } from "../prompts/PromptSheet";
import { PromptSheetContext } from "../prompts/PromptSheetContext";
import type { PromptId, PromptParams } from "@/lib/prompts/registry";
import { importHrefFor } from "../prompts/routes";
import { BottomNav } from "./BottomNav";
import { OfflineBadge } from "./OfflineBadge";
import { StatusBanners } from "./StatusBanners";
import { useTripWeather } from "../weather/useTripWeather";
import { useToday } from "@/lib/use-today";
import { warmPages } from "../offline/sw";
import { refreshPushDevice } from "../notifications/push";
import { useProfileSync } from "../setup/useProfileSync";

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations("tripNav");
  const tp = useTranslations("tripPages");
  const tc = useTranslations("common");
  const data = useTripData();
  const store = useTripStore();
  const pathname = usePathname();
  // Loads the trip's weather once for every screen (and for the prompts built from them).
  useTripWeather(data, useToday());
  // The plan's cities flow into the trip profile (so prompts and the profile agree).
  useProfileSync(data, data.me.role === "owner" || data.me.role === "editor");
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptInitial, setPromptInitial] = useState<{ id: PromptId; params?: PromptParams } | null>(null);
  const openPrompt = (id?: PromptId, params?: PromptParams) => {
    setPromptInitial(id ? { id, params } : null);
    setPromptOpen(true);
  };

  // Keep this trip's screens on the device for offline use (SPEC §10).
  const warmKey = data.status === "ready" && data.live && data.trip ? `${data.trip.id}:${data.days.map((d) => d.date).join(",")}` : "";
  useEffect(() => {
    if (!warmKey) return;
    const [id, dates] = warmKey.split(":");
    const base = `/trips/${id}`;
    const tabs = ["today", "plan", "plan/bookings", "places", "lists/tasks", "lists/packing", "lists/purchases", "lists/notes", "journal", "summary", "guide"];
    void warmPages(["/trips", ...tabs.map((p) => `${base}/${p}`), ...(dates ? dates.split(",").map((d) => `${base}/plan/${d}`) : [])]);
  }, [warmKey]);

  if (data.status === "loading") return <CenteredSpinner label={tc("loading")} />;
  if (data.status === "error") return <ErrorBox onRetry={() => void store.load()} />;
  if (data.status === "not_found" || !data.trip) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-16">
        <EmptyState
          icon="pin"
          title={tp("notFound")}
          action={
            <Link href="/trips" className="font-bold underline underline-offset-4">
              {t("allTrips")}
            </Link>
          }
        />
      </main>
    );
  }

  const trip = data.trip;
  const base = `/trips/${trip.id}`;
  // On a computer the plan and the places get the width; lists and forms stay readable.
  const wide = /\/(today|plan|places|guide|lists\/packing)(\/|$)/.test(pathname) && !/\/(import-|confirm|paste)/.test(pathname);
  const width = wide ? "max-w-xl lg:max-w-6xl" : "max-w-xl lg:max-w-2xl";

  return (
    <PromptSheetContext value={openPrompt}>
    <div className="flex flex-1 flex-col bg-paper lg:ps-56 print:ps-0" style={{ "--trip": trip.theme_color } as CSSProperties}>
      <header className="no-print pt-safe sticky top-0 z-20 bg-paper px-3 pb-1">
        <div className={`mx-auto flex ${width} items-center gap-1`}>
          <Link href="/trips" aria-label={t("allTrips")} className="grid size-11 shrink-0 place-items-center active:bg-surface-2">
            <Icon name="back" className="rtl:-scale-x-100" strokeWidth={2.5} />
          </Link>
          <h1 className="display flex-1 truncate pt-1 text-[2.4rem]">{trip.name}</h1>
          <OfflineBadge />
          <Link href={`${base}/activity`} aria-label={t("activity")} className="grid size-11 shrink-0 place-items-center active:bg-surface-2">
            <Icon name="activity" />
          </Link>
          <Link href={`${base}/settings`} aria-label={t("settings")} className="grid size-11 shrink-0 place-items-center active:bg-surface-2">
            <Icon name="settings" />
          </Link>
        </div>
      </header>
      <StatusBanners base={base} width={width} />
      <div className={`mx-auto flex w-full ${width} flex-1 flex-col px-5 pt-2 lg:px-8 pb-28 lg:pb-10`}>{children}</div>
      <BottomNav tripId={trip.id} onPrompt={() => openPrompt()} pasteHref={importHrefFor(base, pathname)} />
      <PromptSheet open={promptOpen} initial={promptInitial} onClose={() => setPromptOpen(false)} />
    </div>
    </PromptSheetContext>
  );
}

export function TripShell({ children }: { children: ReactNode }) {
  const { tripId } = useParams<{ tripId: string }>();
  // Keeps this device's time zone current for quiet hours and morning reminders.
  useEffect(() => void refreshPushDevice(), []);
  return (
    <TripDataProvider key={tripId} tripId={tripId}>
      <Shell>{children}</Shell>
    </TripDataProvider>
  );
}
