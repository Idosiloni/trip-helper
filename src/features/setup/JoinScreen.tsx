"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { CenteredSpinner } from "@/components/app/CenteredSpinner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Ticket } from "@/components/ui/Ticket";
import { formatDateRange } from "@/lib/dates";
import { keyAfter } from "@/lib/position";
import { supabase } from "@/lib/supabase/client";
import { useAsync } from "@/lib/use-async";

type Preview = { status: string; trip_name: string | null; theme_color: string | null; start_date: string | null; end_date: string | null; inviter_name: string | null; role: string | null };
type TravelerOption = { id: string; label: string; position: string; linked: boolean };

function InstallTip({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations("join");
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="display print-offset text-[4rem]">{t("installTitle")}</h1>
      <p className="text-lg">{t("installWhy")}</p>
      <ol className="flex list-decimal flex-col gap-2 border-2 border-ink bg-surface p-4 ps-8 text-[15px]">
        {(isIos ? [t("ios1"), t("ios2"), t("ios3")] : [t("android1"), t("android2")]).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="text-sm text-ink-2">{t("offlineTip")}</p>
      <Button size="lg" block onClick={onContinue}>
        {t("toTrip")}
      </Button>
    </div>
  );
}

export function JoinScreen() {
  const t = useTranslations("join");
  const tc = useTranslations("common");
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [choice, setChoice] = useState<string>("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinedTrip, setJoinedTrip] = useState<string | null>(null);

  const state = useAsync(async () => {
    const db = supabase();
    const [{ data: preview }, { data: auth }] = await Promise.all([db.rpc("invite_preview", { p_token: token }), db.auth.getUser()]);
    const p = (preview?.[0] ?? { status: "not_found" }) as Preview;
    let travelers: TravelerOption[] = [];
    if (auth.user && p.status === "ok") {
      const { data } = await db.rpc("invite_travelers", { p_token: token });
      travelers = (data ?? []) as TravelerOption[];
    }
    return { preview: p, signedIn: Boolean(auth.user), travelers };
  }, token);

  if (state.status === "loading") return <CenteredSpinner label={tc("loading")} />;
  if (state.status === "error") return <p role="alert">{tc("errorGeneric")}</p>;
  const { preview, signedIn, travelers } = state.data;

  if (joinedTrip) return <InstallTip onContinue={() => router.replace(`/trips/${joinedTrip}/today`)} />;

  if (preview.status !== "ok") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="display print-offset text-[4rem]">{t("invalidTitle")}</h1>
        <p className="text-lg">{t(`invalid.${preview.status as "not_found" | "expired" | "revoked" | "used_up"}`)}</p>
        <Link href="/trips" className="font-bold underline underline-offset-4">
          {t("toMyTrips")}
        </Link>
      </div>
    );
  }

  const free = travelers.filter((x) => !x.linked);

  async function join() {
    setBusy(true);
    setError(null);
    const last = travelers.at(-1)?.position ?? null;
    const { data, error } = await supabase().rpc("accept_invite", {
      p_token: token,
      p_traveler_id: choice === "new" ? undefined : choice,
      p_new_position: choice === "new" ? keyAfter(last) : undefined,
    });
    if (error || !data) {
      setError(tc("errorGeneric"));
      setBusy(false);
      return;
    }
    setJoinedTrip(data);
  }

  return (
    <div className="flex flex-col gap-6" style={{ "--trip": preview.theme_color ?? undefined } as CSSProperties}>
      <p className="flex items-center gap-2 text-sm font-extrabold">
        <Icon name="plane" size={20} className="text-trip-ink" />
        {t("invitedBy", { name: preview.inviter_name || t("someone") })}
      </p>
      <Ticket
        main={
          <div className="relative px-4 pb-3 pt-4">
            <span aria-hidden="true" className="halftone absolute -end-8 -top-8 size-28 rounded-full opacity-50" />
            <h1 className="display relative text-[3.4rem]">{preview.trip_name}</h1>
            {preview.start_date ? <p className="relative font-bold">{formatDateRange(preview.start_date, preview.end_date)}</p> : null}
          </div>
        }
        stub={<div className="px-4 py-2 text-sm font-bold">{t("asRole", { role: t(`roles.${preview.role as "editor" | "viewer"}`) })}</div>}
      />

      {!signedIn ? (
        <div className="flex flex-col gap-3">
          <p className="text-lg">{t("signInFirst")}</p>
          <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`} className="flex min-h-14 items-center justify-center bg-ink text-lg font-extrabold text-on-ink shadow-[4px_4px_0_0_var(--trip-tint)]">
            {t("signIn")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {free.length ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-lg font-extrabold">{t("whoAreYou")}</legend>
              {[...free.map((f) => ({ id: f.id, label: f.label })), { id: "new", label: t("notOnList") }].map((o) => (
                <label key={o.id} className={`flex min-h-12 cursor-pointer items-center gap-3 border-2 border-ink px-3 ${choice === o.id ? "bg-ink text-on-ink" : "bg-surface"}`}>
                  <input type="radio" name="who" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} className="sr-only" />
                  <span className="font-bold">{o.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="font-bold text-danger">
              {error}
            </p>
          ) : null}
          <Button size="lg" block loading={busy} onClick={join}>
            {t("join")}
          </Button>
        </div>
      )}
    </div>
  );
}
