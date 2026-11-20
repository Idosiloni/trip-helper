"use client";

import { ChangePassword } from "./ChangePassword";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/app/Avatar";
import { CenteredSpinner } from "@/components/app/CenteredSpinner";
import { ErrorBox } from "@/components/app/ErrorBox";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { TextField } from "@/components/ui/TextField";
import { supabase } from "@/lib/supabase/client";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";
import { useAsync } from "@/lib/use-async";
import { NotificationsSection } from "@/features/notifications/NotificationsSection";
import { forgetDeviceOnSignOut } from "@/features/notifications/push";
import { clearDeviceData } from "@/lib/offline/cached";
import { fetchMe, updateMyProfile, type Me } from "./api";

function ProfileForm({ me }: { me: Me }) {
  const t = useTranslations("me");
  const [name, setName] = useState(me.profile.display_name);
  const [color, setColor] = useState(me.profile.avatar_color);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Each field saves on its own, sending only that column.
  async function save(patch: { display_name?: string; avatar_color?: string }) {
    await updateMyProfile(me.id, patch);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} color={color} size={64} />
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold">{name}</p>
          <p className="truncate text-sm text-ink-2">
            {t.rich("signedInAs", { email: me.email, addr: (chunks) => <bdi dir="ltr">{chunks}</bdi> })}
          </p>
        </div>
        <span aria-live="polite" className="ms-auto text-sm font-bold text-ok">
          {saved ? t("saved") : ""}
        </span>
      </div>
      <TextField
        label={t("nameLabel")}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== me.profile.display_name) void save({ display_name: trimmed });
        }}
      />
      <ColorPicker
        label={t("colorLabel")}
        value={color}
        onChange={(c) => {
          setColor(c);
          void save({ avatar_color: c });
        }}
      />
    </div>
  );
}

function ThemePicker() {
  const t = useTranslations("me");
  const [theme, setTheme] = useState<ThemeChoice>("system");
  // localStorage only exists in the browser, so read it after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setTheme(readTheme()), []);
  return (
    <Segmented
      label={t("themeLabel")}
      value={theme}
      onChange={(v) => {
        setTheme(v);
        applyTheme(v);
      }}
      options={[
        { value: "system", label: t("themeSystem") },
        { value: "light", label: t("themeLight") },
        { value: "dark", label: t("themeDark") },
      ]}
    />
  );
}

export function MeScreen() {
  const t = useTranslations("me");
  const tc = useTranslations("common");
  const tNav = useTranslations("tripNav");
  const router = useRouter();
  const me = useAsync(fetchMe, "me");
  const [signingOut, setSigningOut] = useState(false);

  return (
    <>
      <PageHeader title={t("title")} backHref="/trips" backLabel={tNav("allTrips")} />
      <main className="pb-safe mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 pb-10">
        {me.status === "loading" ? (
          <CenteredSpinner label={tc("loading")} />
        ) : me.status === "error" || !me.data ? (
          <ErrorBox onRetry={me.reload} />
        ) : (
          <ProfileForm me={me.data} />
        )}
        <ThemePicker />
        {me.status === "ready" && me.data ? <NotificationsSection userId={me.data.id} /> : null}
        {me.status === "ready" && me.data ? <ChangePassword /> : null}
        <Button
          variant="danger"
          block
          loading={signingOut}
          icon={<Icon name="logout" className="rtl:-scale-x-100" />}
          onClick={async () => {
            setSigningOut(true);
            await forgetDeviceOnSignOut();
            await supabase().auth.signOut();
            await clearDeviceData();
            router.replace("/login");
            router.refresh();
          }}
        >
          {t("signOut")}
        </Button>
      </main>
    </>
  );
}
