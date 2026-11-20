"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { enablePush, pushState, type PushState } from "./push";

const DISMISSED = "push-prompt-dismissed";

/**
 * On the home screen until answered: "get notifications?" (one tap asks the
 * browser), or on an iPhone browser tab, how to install the app first.
 * "Not now" hides it on this device; the full settings stay in the Me screen.
 */
export function PushPrompt() {
  const t = useTranslations("notifications");
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {}
    if (dismissed) return;
    let alive = true;
    pushState()
      .then((s) => alive && setState(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (state !== "off" && state !== "ios-install") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
    setState(null);
  }

  async function enable() {
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      if (s !== "on") showToast({ message: s === "denied" ? t("denied") : t("enableFailed") });
    } catch {
      showToast({ message: t("enableFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 border-2 border-ink bg-surface p-3">
      <p className="flex items-center gap-2 font-extrabold">
        <Icon name="mail" size={18} className="text-trip-ink" />
        {t("promptTitle")}
      </p>
      <p className="text-sm text-ink-2">{state === "ios-install" ? t("iosInstall") : t("offHint")}</p>
      <div className="flex flex-wrap gap-2">
        {state === "off" ? (
          <button type="button" disabled={busy} onClick={() => void enable()} className="flex min-h-11 items-center bg-ink px-3 text-sm font-extrabold text-on-ink disabled:opacity-60">
            {t("enable")}
          </button>
        ) : null}
        <button type="button" onClick={dismiss} className="flex min-h-11 items-center px-2 text-sm font-bold underline underline-offset-4">
          {t("notNow")}
        </button>
      </div>
    </section>
  );
}
