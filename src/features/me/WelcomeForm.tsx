"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/app/Avatar";
import { CenteredSpinner } from "@/components/app/CenteredSpinner";
import { ErrorBox } from "@/components/app/ErrorBox";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { TextField } from "@/components/ui/TextField";
import { safeNext } from "@/lib/safe-next";
import { useAsync } from "@/lib/use-async";
import { fetchMe, updateMyProfile } from "./api";

export function WelcomeForm() {
  const t = useTranslations("welcome");
  const tc = useTranslations("common");
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const me = useAsync(fetchMe, "me");

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (me.status === "loading") return <CenteredSpinner label={tc("loading")} />;
  if (me.status === "error" || !me.data) return <ErrorBox onRetry={me.reload} />;

  const profile = me.data.profile;
  const chosenColor = color ?? profile.avatar_color;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile(profile.id, { display_name: trimmed, avatar_color: chosenColor });
      router.replace(next);
    } catch {
      setError(tc("errorGeneric"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="display print-offset text-[4.5rem]">{t("title")}</h1>
          <p className="text-lg text-ink-2">{t("subtitle")}</p>
        </div>
        <Avatar name={name || "?"} color={chosenColor} size={72} />
      </div>
      <TextField
        label={t("nameLabel")}
        placeholder={t("namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="nickname"
        autoFocus
        error={error}
      />
      <ColorPicker label={t("colorLabel")} value={chosenColor} onChange={setColor} />
      <Button type="submit" size="lg" block loading={busy} disabled={!name.trim()}>
        {t("done")}
      </Button>
    </form>
  );
}
