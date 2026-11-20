"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { TemplateActions } from "../templates/TemplateActions";
import { SimulatedDate } from "./SimulatedDate";
import { patchTrip } from "../trip-data/mutations";
import { useTripData, useTripStore } from "../trip-data/TripDataProvider";

function Row({ href, icon, title, body }: { href: string; icon: IconName; title: string; body: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 border-b-2 border-ink py-3 active:bg-surface-2">
      <Icon name={icon} />
      <span className="flex flex-1 flex-col">
        <span className="text-lg font-extrabold">{title}</span>
        <span className="text-sm text-ink-2">{body}</span>
      </span>
      <Icon name="chevron" className="ltr:-scale-x-100" />
    </Link>
  );
}

/** Per-trip mute for this user's notifications (SPEC §12). */
function MuteSwitch({ tripId, userId, prefs }: { tripId: string; userId: string; prefs: Record<string, unknown> }) {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const [muted, setMuted] = useState(prefs.muted === true);
  return (
    <Switch
      label={t("muteTrip")}
      hint={t("muteTripHint")}
      checked={muted}
      onChange={async (on) => {
        setMuted(on);
        const { error } = await supabase()
          .from("trip_members")
          .update({ notification_prefs: { ...prefs, muted: on } })
          .eq("trip_id", tripId)
          .eq("user_id", userId);
        if (error) {
          setMuted(!on);
          showToast({ message: tc("errorGeneric") });
        }
      }}
    />
  );
}

export function SettingsHub() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const data = useTripData();
  const store = useTripStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const trip = data.trip!;
  const base = `/trips/${trip.id}`;
  const live = <T extends { deleted_at: string | null }>(r: T[]) => r.filter((x) => !x.deleted_at);
  const isOwner = data.me.role === "owner";
  const myMember = data.members.find((m) => m.user_id === data.me.userId);

  async function archive(on: boolean) {
    setBusy(true);
    try {
      await patchTrip(store, { archived_at: on ? new Date().toISOString() : null });
      showToast({ message: on ? t("archived") : t("unarchived") });
    } catch {
      showToast({ message: tc("errorGeneric") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm", { name: trip.name }))) return;
    setBusy(true);
    try {
      await patchTrip(store, { deleted_at: new Date().toISOString() });
      router.replace("/trips");
    } catch {
      showToast({ message: tc("errorGeneric") });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      <SubHeader title={t("title")} backHref={`${base}/today`} backLabel={tc("back")} />
      <nav className="flex flex-col border-t-2 border-ink">
        <Row href={`${base}/settings/profile`} icon="pin" title={t("profile")} body={t("profileBody")} />
        <Row href={`${base}/settings/travelers`} icon="users" title={t("travelers")} body={t("travelersBody", { n: live(data.travelers).length })} />
        <Row href={`${base}/settings/members`} icon="share" title={t("members")} body={t("membersBody", { n: data.members.length })} />
        <Row href={`${base}/activity`} icon="activity" title={t("activity")} body={t("activityBody")} />
        <Row href={`${base}/import/plan`} icon="paste" title={t("wholePlan")} body={t("wholePlanBody")} />
        <Row href={`${base}/guide`} icon="route" title={t("guide")} body={t("guideBody")} />
        <Row href={`${base}/summary`} icon="route" title={t("summary")} body={t("summaryBody")} />
        <Row href={`${base}/journal`} icon="edit" title={t("journal")} body={t("journalBody")} />
        <Row href={`${base}/trash`} icon="trash" title={t("trash")} body={t("trashBody")} />
      </nav>
      {myMember ? (
        <div className="mt-6">
          <MuteSwitch tripId={trip.id} userId={data.me.userId} prefs={(myMember.notification_prefs ?? {}) as Record<string, unknown>} />
        </div>
      ) : null}
      <SimulatedDate start={trip.start_date} end={trip.end_date} />
      <section className="mt-8 flex flex-col gap-3">
        <h3 className="text-sm font-extrabold">{t("nextTime")}</h3>
        <TemplateActions />
      </section>
      {isOwner ? (
        <section className="mt-8 flex flex-col gap-3">
          <h3 className="text-sm font-extrabold">{t("ownerZone")}</h3>
          <Button variant="secondary" loading={busy} onClick={() => archive(!trip.archived_at)}>
            {trip.archived_at ? t("unarchive") : t("archive")}
          </Button>
          <Button variant="danger" loading={busy} onClick={remove}>
            {t("delete")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
