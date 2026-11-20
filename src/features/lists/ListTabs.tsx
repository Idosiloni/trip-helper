"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Tasks | Packing | Purchases | Notes tabs under the Lists tab. */
export function ListTabs({ tripId }: { tripId: string }) {
  const t = useTranslations("lists");
  const pathname = usePathname();
  const base = `/trips/${tripId}/lists`;
  // Each list has its own accent (globals.css --c-*), so they don't look alike.
  const tabs: { href: string; label: string; icon: IconName; color: string }[] = [
    { href: `${base}/tasks`, label: t("tasks"), icon: "check", color: "var(--c-tasks)" },
    { href: `${base}/packing`, label: t("packing"), icon: "bag", color: "var(--c-packing)" },
    { href: `${base}/purchases`, label: t("purchases"), icon: "star", color: "var(--c-purchases)" },
    { href: `${base}/notes`, label: t("notes"), icon: "lists", color: "var(--c-notes)" },
  ];
  return (
    <nav aria-label={t("title")} className="-mx-4 mb-4 flex gap-5 overflow-x-auto border-b-2 border-ink px-4">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            style={active ? { boxShadow: `inset 0 -5px 0 0 ${tab.color}` } : undefined}
            className={cn("flex min-h-11 shrink-0 items-center gap-1.5 text-base", active ? "font-extrabold" : "text-ink-2")}
          >
            <Icon name={tab.icon} size={16} strokeWidth={active ? 3 : 2} style={{ color: tab.color }} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
