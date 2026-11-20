"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Avatar } from "@/components/app/Avatar";
import { CenteredSpinner } from "@/components/app/CenteredSpinner";
import { ErrorBox } from "@/components/app/ErrorBox";
import { SetupNotice } from "@/components/app/SetupNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { useAsync } from "@/lib/use-async";
import { useToday } from "@/lib/use-today";
import { fetchMe, needsOnboarding } from "../me/api";
import { bucketTrips, listMyTrips } from "./api";
import { PastTripRow, TripCard } from "./TripCard";

function NewTripButton({ label, block }: { label: string; block?: boolean }) {
  return (
    <Link
      href="/trips/new"
      className={`inline-flex min-h-14 items-center justify-center gap-2 bg-ink px-6 text-lg font-extrabold text-on-ink shadow-[4px_4px_0_0_var(--trip-tint)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_var(--trip-tint)] ${block ? "w-full" : ""}`}
    >
      <Icon name="plus" strokeWidth={3} />
      {label}
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-extrabold">{children}</h2>;
}

export function TripsHome() {
  const t = useTranslations("trips");
  const tc = useTranslations("common");
  const tMe = useTranslations("me");
  const router = useRouter();
  // Decide on onboarding from the fetch itself, never from rendered state: with Cache
  // Components, a page left earlier is kept in the background (React Activity) and comes
  // back showing its old data before the refetch finishes.
  const me = useAsync(async () => {
    if (!hasSupabaseEnv) return null;
    const fresh = await fetchMe();
    if (fresh && needsOnboarding(fresh)) router.replace("/welcome?next=/trips");
    return fresh;
  }, "me");
  const trips = useAsync(() => (hasSupabaseEnv ? listMyTrips() : Promise.resolve([])), "trips");
  const today = useToday();
  const profile = me.status === "ready" ? me.data?.profile : undefined;

  return (
    <>
      <header className="pt-safe px-5 pb-2">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3 pt-4">
          <h1 className="display print-offset text-[5.25rem]">
            {t("title")}
          </h1>
          <Link href="/me" aria-label={tMe("title")} className="mt-1 grid size-11 place-items-center rounded-full active:scale-95">
            {profile ? (
              <Avatar name={profile.display_name} color={profile.avatar_color} size={44} />
            ) : (
              <span className="grid size-11 place-items-center rounded-full border-2 border-ink">
                <Icon name="user" />
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className="pb-safe mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 px-5 pb-32 pt-3">
        {!hasSupabaseEnv ? <SetupNotice /> : null}
        {trips.status === "loading" || !today ? (
          <CenteredSpinner label={tc("loading")} />
        ) : trips.status === "error" ? (
          <ErrorBox onRetry={trips.reload} />
        ) : trips.data.length === 0 ? (
          <EmptyState icon="plane" title={t("emptyTitle")} body={t("emptyBody")} action={<NewTripButton label={t("newTrip")} />} />
        ) : (
          (() => {
            const b = bucketTrips(trips.data, today);
            return (
              <>
                {b.now.length > 0 ? (
                  <section className="flex flex-col gap-3">
                    <SectionTitle>{t("now")}</SectionTitle>
                    {b.now.map((trip) => <TripCard key={trip.id} trip={trip} today={today} />)}
                  </section>
                ) : null}
                {b.upcoming.length > 0 ? (
                  <section className="flex flex-col gap-4">
                    <SectionTitle>{t("upcoming")}</SectionTitle>
                    {b.upcoming.map((trip) => <TripCard key={trip.id} trip={trip} today={today} />)}
                  </section>
                ) : null}
                {b.archive.length > 0 ? (
                  <section className="flex flex-col gap-3">
                    <SectionTitle>{t("archive")}</SectionTitle>
                    {b.archive.map((trip) => <PastTripRow key={trip.id} trip={trip} />)}
                  </section>
                ) : null}
              </>
            );
          })()
        )}
      </main>
      {trips.status === "ready" && trips.data.length > 0 ? (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 bg-paper px-5 pb-4 pt-3">
          <div className="mx-auto max-w-xl">
            <NewTripButton label={t("newTrip")} block />
          </div>
        </div>
      ) : null}
    </>
  );
}
