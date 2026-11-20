"use client";

import { P13_MAX_PLAN } from "@/lib/prompts/templates/p13-whole-plan";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubHeader } from "@/components/app/SubHeader";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { showToast } from "@/components/ui/Toast";
import { buildPrompt, chatUrl, CHAT_APPS } from "@/lib/prompts/registry";
import { useToday } from "@/lib/use-today";
import { copyText } from "../prompts/clipboard";
import { promptContext } from "../prompts/context-from-store";
import { useCanEdit, useTripData } from "../trip-data/TripDataProvider";

/**
 * "We already have a plan" (prompt 13): paste it here, copy a prompt that asks the
 * chat to split it into the app's parts, then paste the answer back and import
 * every part in one go.
 */
export function WholePlanScreen({ mode = "plan" }: { mode?: "plan" | "bookings" }) {
  const t = useTranslations(mode === "plan" ? "whole" : "bookingPaste");
  const promptId = mode === "plan" ? "p13-whole-plan" : "p14-bookings";
  const tc = useTranslations("common");
  const snap = useTripData();
  const canEdit = useCanEdit();
  const today = useToday() ?? "";
  const base = `/trips/${snap.trip!.id}`;
  const back = mode === "plan" ? `${base}/today` : `${base}/plan/bookings`;
  const [plan, setPlan] = useState("");
  const [copied, setCopied] = useState(false);
  const prompt = plan.trim() ? buildPrompt(promptId, promptContext(snap, null, today), { planText: plan }) : "";

  async function copy() {
    const ok = await copyText(prompt);
    setCopied(ok);
    if (!ok) showToast({ message: tc("errorGeneric") });
  }

  async function pasteFromClipboard() {
    try {
      setPlan(await navigator.clipboard.readText());
    } catch {
      showToast({ message: t("clipboardBlocked") });
    }
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-4">
        <SubHeader title={t("title")} backHref={back} backLabel={tc("back")} />
        <p>{t("viewerCant")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SubHeader title={t("title")} backHref={back} backLabel={tc("back")} />
      <ol className="flex flex-col gap-1 text-[15px]">
        <li>
          <b>1.</b> {t("step1")}
        </li>
        <li>
          <b>2.</b> {t("step2")}
        </li>
        <li>
          <b>3.</b> {t("step3")}
        </li>
      </ol>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="whole-plan" className="text-sm font-bold">
            {t("planLabel")}
          </label>
          <button type="button" onClick={pasteFromClipboard} className="flex min-h-11 items-center gap-1.5 text-sm font-bold underline underline-offset-4">
            <Icon name="paste" size={16} />
            {t("fromClipboard")}
          </button>
        </div>
        <textarea
          id="whole-plan"
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setCopied(false);
          }}
          rows={12}
          dir="auto"
          maxLength={P13_MAX_PLAN}
          placeholder={t("planPlaceholder")}
          className="w-full border-2 border-ink bg-surface p-3 text-sm"
        />
        {plan.length > 25000 ? <p className="text-sm font-bold">{t("longPlan", { n: Math.round(plan.length / 1000) })}</p> : null}
        <p className="text-xs text-ink-2">{t("privacy")}</p>
      </div>

      <Button size="lg" block disabled={!prompt} icon={<Icon name="copy" size={18} />} onClick={copy}>
        {copied ? t("copied") : t("copyPrompt")}
      </Button>
      {copied ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold">{t("openIn")}</p>
          <div className="grid grid-cols-3 gap-2">
            {CHAT_APPS.map((app) => (
              <a key={app.id} href={chatUrl(app, prompt)} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center border-2 border-ink bg-surface font-bold">
                {app.label}
              </a>
            ))}
          </div>
          <Link href={`${base}/import?prompt=${promptId}`} className="flex min-h-14 items-center justify-center gap-2 bg-ink text-lg font-extrabold text-on-ink">
            <Icon name="paste" size={18} />
            {t("pasteAnswer")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
