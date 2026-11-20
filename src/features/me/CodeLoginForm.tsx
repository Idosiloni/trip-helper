"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { SetupNotice } from "@/components/app/SetupNotice";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OtpInput } from "@/components/ui/OtpInput";
import { TextField } from "@/components/ui/TextField";
import { safeNext } from "@/lib/safe-next";
import { supabase } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { fetchMe, needsOnboarding } from "./api";

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = { kind: "email" } | { kind: "code"; email: string };

function isRateLimit(error: { status?: number; code?: string } | null) {
  return error?.status === 429 || error?.code === "over_email_send_rate_limit";
}

export function CodeLoginForm() {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function sendCode(address: string) {
    setBusy(true);
    setError(null);
    // The code email template (supabase/templates/otp-code.html) needs custom SMTP on the
    // free tier; without it Supabase sends a link instead of {{ .Token }}.
    const { error } = await supabase().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      // Never show Supabase's raw (English) message to the family.
      console.error("signInWithOtp failed", error.code, error.message);
      setError(
        isRateLimit(error)
          ? t("rateLimited")
          : error.code === "email_address_invalid"
            ? t("invalidEmail")
            : t("sendFailed"),
      );
      return false;
    }
    setResendIn(RESEND_SECONDS);
    return true;
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) {
      setError(t("invalidEmail"));
      return;
    }
    if (await sendCode(address)) {
      setCode("");
      setStep({ kind: "code", email: address });
    }
  }

  async function verify(token: string) {
    if (step.kind !== "code") return;
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({ email: step.email, token, type: "email" });
    if (error) {
      setBusy(false);
      setCode("");
      setError(isRateLimit(error) ? t("rateLimited") : t("wrongCode"));
      return;
    }
    const me = await fetchMe().catch(() => null);
    const destination = me && needsOnboarding(me) ? `/welcome?next=${encodeURIComponent(next)}` : next;
    router.replace(destination);
    router.refresh();
  }

  function onCodeChange(value: string) {
    setCode(value);
    if (value.length === 6 && !busy) void verify(value);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="relative flex flex-col gap-2">
        <span aria-hidden="true" className="halftone absolute -end-6 -top-10 size-36 rounded-full opacity-40" />
        <p className="relative flex items-center gap-2 text-sm font-extrabold">
          <Icon name={step.kind === "email" ? "plane" : "mail"} size={20} className="text-trip-ink" />
          {tApp("name")}
        </p>
        <h1 className="display print-offset relative text-[5.5rem]">{step.kind === "email" ? t("title") : t("codeTitle")}</h1>
        <p className="relative text-lg text-ink-2">
          {step.kind === "email" ? (
            t("subtitle")
          ) : (
            t.rich("codeSubtitle", {
              email: () => (
                <bdi dir="ltr" className="font-bold text-ink">
                  {step.email}
                </bdi>
              ),
            })
          )}
        </p>
      </div>

      {!hasSupabaseEnv ? <SetupNotice /> : null}

      {step.kind === "email" ? (
        <form onSubmit={onEmailSubmit} className="flex flex-col gap-5" noValidate>
          <TextField
            label={t("emailLabel")}
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            autoFocus
          />
          <Button type="submit" size="lg" block loading={busy} disabled={!hasSupabaseEnv}>
            {busy ? t("sending") : t("sendCode")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <OtpInput label={t("codeLabel")} value={code} onChange={onCodeChange} error={Boolean(error)} disabled={busy} autoFocus />
          <div aria-live="polite" className="min-h-6 text-center text-sm">
            {error ? <p className="font-medium text-danger">{error}</p> : busy ? <p className="text-ink-2">{t("verifying")}</p> : <p className="text-ink-3">{t("spamHint")}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              block
              disabled={resendIn > 0 || busy}
              onClick={() => void sendCode(step.email)}
            >
              {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
            </Button>
            <Button
              variant="ghost"
              block
              onClick={() => {
                setStep({ kind: "email" });
                setError(null);
              }}
            >
              {t("changeEmail")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
