"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TextField } from "@/components/ui/TextField";
import { supabase } from "@/lib/supabase/client";
import { MIN_PASSWORD } from "./PasswordLoginForm";

/** Lands from the reset email (?code=): signs in with the code, then asks for a new password. */
export function ResetPasswordScreen() {
  const t = useTranslations("login");
  const tm = useTranslations("me");
  const tc = useTranslations("common");
  const router = useRouter();
  const code = useSearchParams().get("code");
  const [phase, setPhase] = useState<"checking" | "ready" | "bad">(code ? "checking" : "bad");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current) return;
    started.current = true;
    void supabase()
      .auth.exchangeCodeForSession(code)
      .then(({ error: e }) => {
        if (e) console.error("reset code", e.code, e.message);
        setPhase(e ? "bad" : "ready");
      });
  }, [code]);

  async function save() {
    setError(null);
    if (pw.length < MIN_PASSWORD) return setError(tm("passwordShort", { n: MIN_PASSWORD }));
    if (pw !== again) return setError(tm("passwordMismatch"));
    setBusy(true);
    const { error: e } = await supabase().auth.updateUser({ password: pw });
    if (e) {
      setBusy(false);
      return setError(e.code === "same_password" ? tm("passwordSame") : tc("errorGeneric"));
    }
    router.replace("/trips");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="display print-offset text-[4.5rem]">{t("resetTitle")}</h1>
      {phase === "checking" ? (
        <Spinner />
      ) : phase === "bad" ? (
        <div className="flex flex-col gap-3">
          <p>{t("resetBadLink")}</p>
          <Link href="/login" className="font-bold underline underline-offset-4">
            {t("backToLogin")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TextField label={tm("newPassword")} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <TextField label={tm("newPasswordAgain")} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={error} />
          <Button size="lg" block loading={busy} disabled={!pw || !again} onClick={save}>
            {tc("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
