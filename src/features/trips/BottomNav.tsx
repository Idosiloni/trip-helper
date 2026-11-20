"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";

const TABS: ReadonlyArray<{ segment: "today" | "plan" | "places" | "lists"; icon: IconName }> = [
  { segment: "today", icon: "sun" },
  { segment: "plan", icon: "route" },
  { segment: "places", icon: "pin" },
  { segment: "lists", icon: "lists" },
];

const tabClass = "flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 text-[13px] lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-base";

/**
 * Phone: a bar at the bottom, with a "צ'אט" tab that opens copy prompt / paste answer.
 * Computer (lg): a rail down the side, with both chat actions spelled out at its foot.
 * (Feedback 2026-11-20: a floating bar covered list rows and the plan table.)
 */
export function BottomNav({ tripId, onPrompt, pasteHref }: { tripId: string; onPrompt: () => void; pasteHref: string }) {
  const t = useTranslations("tripNav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [chat, setChat] = useState(false);
  return (
    <>
      <nav
        aria-label={t("tripTabs")}
        className="no-print pb-safe fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper lg:inset-x-auto lg:inset-y-0 lg:start-0 lg:flex lg:w-56 lg:flex-col lg:border-e-2 lg:border-t-0 lg:pb-0 lg:pt-24"
      >
        <ul className="mx-auto flex w-full max-w-xl lg:flex-col lg:gap-1 lg:px-3">
          {TABS.map(({ segment, icon }) => {
            const root = `/trips/${tripId}/${segment}`;
            const href = segment === "lists" ? `${root}/tasks` : root;
            const active = pathname === root || pathname.startsWith(`${root}/`);
            return (
              <li key={segment} className="flex-1 lg:flex-none">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(tabClass, active ? "font-extrabold text-ink lg:bg-surface lg:shadow-[3px_3px_0_0_var(--trip)] lg:outline lg:outline-2 lg:outline-ink" : "text-ink-2 lg:hover:bg-surface-2")}
                >
                  <Icon name={icon} size={22} strokeWidth={active ? 2.4 : 2} />
                  <span className={cn(active && "shadow-[inset_0_-4px_0_0_var(--trip)]")}>{t(segment)}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1 lg:hidden">
            <button type="button" onClick={() => setChat(true)} aria-haspopup="dialog" className={cn(tabClass, "w-full font-bold text-ink")}>
              <span className="grid size-7 place-items-center bg-ink text-on-ink">
                <Icon name="chat" size={18} />
              </span>
              <span>{t("chat")}</span>
            </button>
          </li>
        </ul>
        <div className="mt-auto hidden flex-col gap-2 border-t-2 border-ink p-3 lg:flex">
          <button type="button" onClick={onPrompt} className="flex min-h-11 items-center gap-2 border-2 border-ink bg-surface px-3 text-sm font-extrabold active:translate-y-px">
            <Icon name="copy" size={16} />
            {t("copyPrompt")}
          </button>
          <Link href={pasteHref} className="flex min-h-11 items-center gap-2 border-2 border-ink bg-ink px-3 text-sm font-extrabold text-on-ink active:translate-y-px">
            <Icon name="paste" size={16} />
            {t("pasteAnswer")}
          </Link>
        </div>
      </nav>
      <Sheet open={chat} onClose={() => setChat(false)} title={t("chatTitle")} closeLabel={tc("close")}>
        <p className="mb-4 text-sm text-ink-2">{t("chatHint")}</p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setChat(false);
              onPrompt();
            }}
            className="flex min-h-14 items-center gap-3 border-2 border-ink bg-surface px-4 text-lg font-extrabold"
          >
            <Icon name="copy" size={20} />
            {t("copyPrompt")}
          </button>
          <Link href={pasteHref} onClick={() => setChat(false)} className="flex min-h-14 items-center gap-3 border-2 border-ink bg-ink px-4 text-lg font-extrabold text-on-ink">
            <Icon name="paste" size={20} />
            {t("pasteAnswer")}
          </Link>
        </div>
      </Sheet>
    </>
  );
}
