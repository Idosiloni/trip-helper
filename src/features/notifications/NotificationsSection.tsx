"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { useAsync } from "@/lib/use-async";
import { disablePush, enablePush, pushState, sendTestNotification, type PushState } from "./push";

export const NOTIFICATION_KINDS = ["assigned", "done", "import", "joined", "bookings", "reminders"] as const;

type Settings = Pick<Tables<"notification_settings">, "kinds" | "quiet_enabled" | "quiet_start" | "quiet_end">;
const DEFAULTS: Settings = { kinds: {}, quiet_enabled: true, quiet_start: "22:00", quiet_end: "07:00" };

async function loadSettings(userId: string): Promise<Settings> {
  const { data, error } = await supabase()
    .from("notification_settings")
    .select("kinds, quiet_enabled, quiet_start, quiet_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULTS;
}

function SettingsForm({ userId, initial }: { userId: string; initial: Settings }) {
  const t = useTranslations("notifications");
  const [s, setS] = useState(initial);
  const kinds = (s.kinds ?? {}) as Record<string, boolean>;

  // Only the changed columns are sent (SPEC §11).
  async function save(patch: Partial<Settings>) {
    const prev = s;
    setS({ ...s, ...patch });
    const { error } = await supabase().from("notification_settings").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
    if (error) {
      setS(prev);
      showToast({ message: t("saveFailed") });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <h3 className="mt-2 text-sm font-bold text-ink-2">{t("kindsTitle")}</h3>
      {NOTIFICATION_KINDS.map((k) => (
        <Switch
          key={k}
          label={t(`kind.${k}`)}
          checked={kinds[k] !== false}
          onChange={(on) => void save({ kinds: { ...kinds, [k]: on } })}
        />
      ))}
      <div className="mt-4 border-t-2 border-ink/15 pt-3">
        <Switch
          label={t("quietLabel")}
          hint={t("quietHint")}
          checked={s.quiet_enabled}
          onChange={(on) => void save({ quiet_enabled: on })}
        />
        {s.quiet_enabled ? (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <TextField
              type="time"
              label={t("quietFrom")}
              value={s.quiet_start.slice(0, 5)}
              onChange={(e) => e.target.value && void save({ quiet_start: e.target.value })}
            />
            <TextField
              type="time"
              label={t("quietTo")}
              value={s.quiet_end.slice(0, 5)}
              onChange={(e) => e.target.value && void save({ quiet_end: e.target.value })}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationsSection({ userId }: { userId: string }) {
  const t = useTranslations("notifications");
  const device = useAsync(pushState, "push-state");
  const settings = useAsync(() => loadSettings(userId), `notification-settings:${userId}`);
  const [override, setOverride] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const state = override ?? (device.status === "ready" ? device.data : null);

  async function run(fn: () => Promise<PushState>) {
    setBusy(true);
    try {
      setOverride(await fn());
    } catch {
      showToast({ message: t("enableFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="notifications-title" className="flex flex-col gap-3">
      <h2 id="notifications-title" className="display text-3xl">
        {t("title")}
      </h2>

      {state === null ? null : state === "unsupported" ? (
        <p className="text-ink-2">{t("unsupported")}</p>
      ) : state === "ios-install" ? (
        <p className="border-2 border-ink bg-surface p-3">{t("iosInstall")}</p>
      ) : state === "denied" ? (
        <p className="border-2 border-ink bg-surface p-3">{t("denied")}</p>
      ) : state === "off" ? (
        <>
          <p className="text-ink-2">{t("offHint")}</p>
          <Button block loading={busy} onClick={() => void run(enablePush)}>
            {t("enable")}
          </Button>
        </>
      ) : (
        <>
          <p className="font-bold">{t("onThisDevice")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await sendTestNotification();
                  showToast({ message: ok ? t("testSent") : t("testNoTrip") });
                } catch {
                  showToast({ message: t("enableFailed") });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("test")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void run(disablePush)}>
              {t("disable")}
            </Button>
          </div>
        </>
      )}

      {settings.status === "ready" && settings.data ? <SettingsForm userId={userId} initial={settings.data} /> : null}
    </section>
  );
}
