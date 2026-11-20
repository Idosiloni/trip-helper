"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { SetupNotice } from "@/components/app/SetupNotice";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { TextField } from "@/components/ui/TextField";
import { safeNext } from "@/lib/safe-next";
import { supabase } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { fetchMe, needsOnboarding } from "./api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 6;

type Mode = "signin" | "signup";

/**
 * Email + password (no emails are sent; "confirm email" is off in Supabase).
 * Temporary until SMTP exists; NEXT_PUBLIC_AUTH_METHOD=otp switches back to
 * the 6-digit code flow (CodeLoginForm) from SPEC §11.
 */
export function PasswordLoginForm() {
  const t = useTranslations("login");
  const tApp = useTranslations("app");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  // Coming from an invite link usually means a new person: start on "sign up".
  const [mode, setMode] = useState<Mode>(next.startsWith("/join/") ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) return setError(t("invalidEmail"));
    if (password.length < MIN_PASSWORD) return setError(t("shortPassword", { n: MIN_PASSWORD }));
    setBusy(true);
    setError(null);
    const db = supabase();
    const { error } =
      mode === "signin"
        ? await db.auth.signInWithPassword({ email: address, password })
        : await db.auth.signUp({ email: address, password });
    if (error) {
      console.error("auth failed", error.code, error.message);
      setBusy(false);
      setError(
        error.code === "invalid_credentials"
          ? t("wrongPassword")
          : error.code === "user_already_exists"
            ? t("alreadyExists")
            : error.code === "weak_password"
              ? t("shortPassword", { n: MIN_PASSWORD })
              : error.code === "email_address_invalid"
                ? t("invalidEmail")
                : error.status === 429
                  ? t("rateLimited")
                  : tc("errorGeneric"),
      );
      return;
    }
    const me = await fetchMe().catch(() => null);
    router.replace(me && needsOnboarding(me) ? `/welcome?next=${encodeURIComponent(next)}` : next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="relative flex flex-col gap-2">
        <span aria-hidden="true" className="halftone absolute -end-6 -top-10 size-36 rounded-full opacity-40" />
        <p className="relative flex items-center gap-2 text-sm font-extrabold">
          <Icon name="plane" size={20} className="text-trip-ink" />
          {tApp("name")}
        </p>
        <h1 className="display print-offset relative text-[5.5rem]">{mode === "signin" ? t("title") : t("signupTitle")}</h1>
        <p className="relative text-lg text-ink-2">{mode === "signin" ? t("passwordSubtitle") : t("signupSubtitle")}</p>
      </div>

      {!hasSupabaseEnv ? <SetupNotice /> : null}

      <Segmented<Mode>
        label={t("modeLabel")}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "signin", label: t("signinTab") },
          { value: "signup", label: t("signupTab") },
        ]}
      />

      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label={t("emailLabel")}
          type="email"
          inputMode="email"
          autoComplete={mode === "signin" ? "username" : "email"}
          dir="ltr"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <TextField
            label={t("passwordLabel")}
            type={show ? "text" : "password"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === "signup" ? t("passwordHint", { n: MIN_PASSWORD }) : undefined}
            error={error}
          />
          <button type="button" onClick={() => setShow(!show)} className="min-h-11 self-start text-sm font-bold underline underline-offset-4">
            {show ? t("hidePassword") : t("showPassword")}
          </button>
        </div>
        <Button type="submit" size="lg" block loading={busy} disabled={!hasSupabaseEnv}>
          {mode === "signin" ? t("signinButton") : t("signupButton")}
        </Button>
        {mode === "signin" ? <ForgotPassword email={email} /> : null}
      </form>
    </div>
  );
}

/**
 * "Forgot password": Supabase emails a link back to the site root with ?code=, which the
 * proxy forwards to /auth/reset. The link must be opened in the same browser that asked
 * for it (PKCE). Until app SMTP is set up, Supabase's built-in sender may refuse or rate-limit.
 */
function ForgotPassword({ email }: { email: string }) {
  const t = useTranslations("login");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed" | "badEmail">("idle");
  async function send() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) return setState("badEmail");
    setState("busy");
    const { error } = await supabase().auth.resetPasswordForEmail(address, { redirectTo: window.location.origin });
    if (error) console.error("reset failed", error.code, error.message);
    setState(error ? "failed" : "sent");
  }
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={send} disabled={state === "busy"} className="min-h-11 self-start text-sm font-bold underline underline-offset-4">
        {t("forgotButton")}
      </button>
      <p role="status" className="text-sm text-ink-2">
        {state === "sent" ? t("resetSent") : state === "failed" ? t("resetFailed") : state === "badEmail" ? t("resetNeedsEmail") : t("resetHint")}
      </p>
    </div>
  );
}
