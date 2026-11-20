"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { MIN_PASSWORD } from "./PasswordLoginForm";

/** Change your own password while signed in (there is no "forgot password" email yet). */
export function ChangePassword() {
  const t = useTranslations("me");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (pw.length < MIN_PASSWORD) return setError(t("passwordShort", { n: MIN_PASSWORD }));
    if (pw !== again) return setError(t("passwordMismatch"));
    setBusy(true);
    const { error: e } = await supabase().auth.updateUser({ password: pw });
    setBusy(false);
    if (e) return setError(e.code === "same_password" ? t("passwordSame") : tc("errorGeneric"));
    setPw("");
    setAgain("");
    setOpen(false);
    showToast({ message: t("passwordChanged") });
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("changePassword")}
      </Button>
    );
  }
  return (
    <section className="flex flex-col gap-3 border-2 border-ink bg-surface p-4">
      <h2 className="text-lg font-extrabold">{t("changePassword")}</h2>
      <TextField label={t("newPassword")} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <TextField label={t("newPasswordAgain")} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={error} />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
          {tc("cancel")}
        </Button>
        <Button className="flex-[2]" loading={busy} disabled={!pw || !again} onClick={save}>
          {tc("save")}
        </Button>
      </div>
    </section>
  );
}
