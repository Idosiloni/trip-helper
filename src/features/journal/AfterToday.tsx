"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { live } from "../lists/helpers";
import { useOpenPrompt } from "../prompts/PromptSheetContext";
import { TemplateActions } from "../templates/TemplateActions";
import { useTripData } from "../trip-data/TripDataProvider";
import type { JournalEntry } from "../trip-data/types";
import { dayIdFor, JournalCard, JournalSheet } from "./JournalScreen";

/** "רגע מהיום": a journal entry for today, one tap from the Today screen during the trip. */
export function MomentButton({ today }: { today: string }) {
  const t = useTranslations("journal");
  const snap = useTripData();
  const [open, setOpen] = useState(false);
  const base = `/trips/${snap.trip!.id}`;
  const todays = live(snap.journal).filter((e) => e.day_id && e.day_id === dayIdFor(snap, today));
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
        <h3 className="text-lg font-extrabold">{t("moment")}</h3>
        <Link href={`${base}/journal`} className="text-sm font-bold underline underline-offset-4">
          {t("toJournal")}
        </Link>
      </div>
      {todays.length ? <p className="text-sm text-ink-2">{t("todayCount", { n: todays.length })}</p> : <p className="text-sm text-ink-2">{t("momentHint")}</p>}
      <Button variant="secondary" className="self-start" icon={<Icon name="edit" size={18} />} onClick={() => setOpen(true)}>
        {t("add")}
      </Button>
      <JournalSheet key={open ? "open" : "closed"} entry={null} open={open} onClose={() => setOpen(false)} initial={{ dayId: dayIdFor(snap, today) }} />
    </section>
  );
}

/** Today screen after the trip (SPEC §5): memories, the journal, a summary prompt, next time. */
export function AfterToday() {
  const t = useTranslations("after");
  const tj = useTranslations("journal");
  const snap = useTripData();
  const openPrompt = useOpenPrompt();
  const [open, setOpen] = useState<JournalEntry | "new" | null>(null);
  const base = `/trips/${snap.trip!.id}`;
  const places = live(snap.places);
  const visited = places.filter((p) => p.status === "visited").sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const entries = live(snap.journal).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
          <h3 className="text-lg font-extrabold">{t("memories")}</h3>
          <Link href={`${base}/summary`} className="text-sm font-bold underline underline-offset-4">
            {t("toSummary")}
          </Link>
        </div>
        {visited.length ? (
          <>
            <p className="text-sm text-ink-2">{t("visitedCount", { n: visited.length, total: places.length })}</p>
            <ul>
              {visited.slice(0, 6).map((p) => (
                <li key={p.id} className="flex min-h-11 items-center gap-2 border-b border-hair py-1.5">
                  <span className="flex flex-1 flex-col">
                    <span className="text-[17px] font-bold">{p.name}</span>
                    {p.notes ? <span className="line-clamp-1 text-sm text-ink-2">{p.notes}</span> : null}
                  </span>
                  {p.rating ? (
                    <span className="text-trip-ink">
                      <span aria-hidden="true">{"★".repeat(p.rating)}</span>
                      <span className="sr-only">{tj("stars", { n: p.rating })}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-2">
            {t("noVisited")}{" "}
            <Link href={`${base}/places`} className="font-bold underline underline-offset-4">
              {t("toPlaces")}
            </Link>
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-1">
          <h3 className="text-lg font-extrabold">{tj("title")}</h3>
          <Link href={`${base}/journal`} className="text-sm font-bold underline underline-offset-4">
            {t("allEntries", { n: entries.length })}
          </Link>
        </div>
        {entries.length ? (
          <ul className="flex flex-col gap-3">
            {entries.slice(0, 2).map((e) => (
              <li key={e.id}>
                <JournalCard entry={e} onOpen={() => setOpen(e)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">{tj("emptyBody")}</p>
        )}
        <Button variant="secondary" className="self-start" icon={<Icon name="edit" size={18} />} onClick={() => setOpen("new")}>
          {tj("add")}
        </Button>
      </section>

      <section className="flex flex-col gap-3 border-2 border-ink bg-surface p-4">
        <h3 className="text-lg font-extrabold">{t("summaryTitle")}</h3>
        <p className="text-sm text-ink-2">{t("summaryBody")}</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Icon name="copy" size={18} />} onClick={() => openPrompt("p11-summary", { summaryStyle: "journal" })}>
            {t("promptJournal")}
          </Button>
          <Button variant="secondary" icon={<Icon name="copy" size={18} />} onClick={() => openPrompt("p11-summary", { summaryStyle: "post" })}>
            {t("promptPost")}
          </Button>
        </div>
        <button type="button" onClick={() => setOpen("new")} className="flex min-h-11 items-center gap-2 self-start font-bold underline underline-offset-4">
          <Icon name="paste" size={18} />
          {t("pasteToJournal")}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="border-b-2 border-ink pb-1 text-lg font-extrabold">{t("nextTime")}</h3>
        <TemplateActions />
      </section>

      <JournalSheet
        key={open === "new" ? "new" : (open?.id ?? "closed")}
        entry={open && open !== "new" ? open : null}
        open={open !== null}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
