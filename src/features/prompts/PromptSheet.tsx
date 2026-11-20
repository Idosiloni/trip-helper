"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { buildPrompt, chatUrl, CHAT_APPS, PROMPTS, type PromptId, type PromptParams } from "@/lib/prompts/registry";
import { useToday } from "@/lib/use-today";
import { profileCities } from "../places/helpers";
import { useTripData } from "../trip-data/TripDataProvider";
import { copyText } from "./clipboard";
import { promptContext } from "./context-from-store";
import { importHrefFor, promptsForPath } from "./routes";

type Chosen = { id: PromptId; params?: PromptParams };

function Preview({ chosen, onBack, onDone }: { chosen: Chosen; onBack: () => void; onDone: () => void }) {
  const t = useTranslations("prompts");
  const snap = useTripData();
  const today = useToday() ?? "";
  const def = PROMPTS[chosen.id];
  const [extra, setExtra] = useState("");
  const generated = useMemo(() => buildPrompt(chosen.id, promptContext(snap, def.kind, today), { ...chosen.params, extra }), [chosen, snap, def.kind, today, extra]);
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? generated;
  const [copied, setCopied] = useState(false);
  const base = `/trips/${snap.trip!.id}`;

  async function copy() {
    setCopied(await copyText(text));
  }

  const step = (n: number, title: string, body?: string) => (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="display grid size-9 shrink-0 place-items-center bg-ink text-xl text-on-ink">
        {n}
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className="font-extrabold leading-tight">{title}</span>
        {body ? <span className="text-sm text-ink-2">{body}</span> : null}
      </span>
    </div>
  );

  // Four plain steps: the path from here to a chat and back is the part people get lost on.
  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 self-start font-bold">
        <Icon name="back" size={20} className="rtl:-scale-x-100" />
        {t("allPrompts")}
      </button>

      <section className="flex flex-col gap-3">
        {step(1, t("how.copyTitle"), t("how.copyBody"))}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">{t("extraLabel")}</span>
          <input
            value={extra}
            onChange={(e) => {
              setExtra(e.target.value);
              setEdited(null);
            }}
            placeholder={t("extraPlaceholder")}
            className="min-h-12 border-2 border-ink bg-surface px-3 text-base"
          />
        </label>
        <Button size="lg" block onClick={copy} icon={<Icon name={copied ? "check" : "copy"} strokeWidth={2.5} />}>
          {copied ? t("copied") : t("copy")}
        </Button>
        <details className="border-2 border-hair">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-bold">{t("previewLabel")}</summary>
          <textarea value={text} onChange={(e) => setEdited(e.target.value)} rows={9} dir="auto" aria-label={t("previewLabel")} className="w-full border-t-2 border-hair bg-surface p-3 text-sm leading-relaxed" />
        </details>
      </section>

      <section className="flex flex-col gap-3">
        {step(2, t("how.chatTitle"), t("how.chatBody"))}
        <div className="grid grid-cols-3 gap-2">
          {CHAT_APPS.map((app) => (
            <a key={app.id} href={chatUrl(app, text)} target="_blank" rel="noopener noreferrer" onClick={() => void copy()} className="flex min-h-12 items-center justify-center border-2 border-ink bg-surface font-bold active:bg-surface-2">
              {app.label}
            </a>
          ))}
        </div>
      </section>

      {def.kind ? (
        <>
          <section className="flex flex-col gap-3">{step(3, t("how.answerTitle"), t("how.answerBody"))}</section>
          <section className="flex flex-col gap-3">
            {step(4, t("how.pasteTitle"))}
            <Link href={importHrefFor(base, "", chosen.id, def.kind)} onClick={onDone} className="flex min-h-12 items-center justify-center gap-2 bg-ink font-extrabold text-on-ink">
              <Icon name="paste" size={18} />
              {t("thenPaste")}
            </Link>
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-3">{step(3, t("how.readTitle"), t("how.readBody"))}</section>
      )}
    </div>
  );
}

export function PromptSheet({ open, initial, onClose }: { open: boolean; initial?: Chosen | null; onClose: () => void }) {
  const t = useTranslations("prompts");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const snap = useTripData();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  // Opening on a specific prompt (e.g. from a "what's missing" card) skips the list.
  const [lastInitial, setLastInitial] = useState<Chosen | null | undefined>(undefined);
  if (open && initial !== lastInitial) {
    setLastInitial(initial);
    setChosen(initial ?? null);
  }
  const entries = promptsForPath(pathname, profileCities(snap));

  function close() {
    setChosen(null);
    setLastInitial(undefined);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={t("title")} closeLabel={tc("close")}>
      {chosen ? (
        <Preview chosen={chosen} onBack={() => setChosen(null)} onDone={close} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-ink-2">{t("intro")}</p>
          {entries.map((e) => (
            <button key={e.key} type="button" onClick={() => setChosen({ id: e.id, params: e.params })} className="flex min-h-16 items-center gap-3 border-2 border-ink bg-surface px-4 py-3 text-start active:bg-surface-2">
              <span className="flex flex-1 flex-col">
                <span className="text-lg font-extrabold">{t(`${PROMPTS[e.id].titleKey}.title`, { city: e.params?.city ?? "" })}</span>
                <span className="text-sm text-ink-2">{t(`${PROMPTS[e.id].titleKey}.body`)}</span>
              </span>
              <Icon name="chevron" className="ltr:-scale-x-100" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
