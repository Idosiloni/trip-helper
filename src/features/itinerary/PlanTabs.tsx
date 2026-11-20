"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/components/ui/cn";

export function PlanTabs({ tripId }: { tripId: string }) {
  const t = useTranslations("plan");
  const pathname = usePathname();
  const base = `/trips/${tripId}/plan`;
  const onBookings = pathname.startsWith(`${base}/bookings`);
  const tabs = [
    { href: base, label: t("days"), active: !onBookings },
    { href: `${base}/bookings`, label: t("bookings"), active: onBookings },
  ];
  return (
    <nav aria-label={t("title")} className="mb-4 flex gap-6 border-b-2 border-ink">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} className={cn("flex min-h-11 items-center text-base", tab.active ? "font-extrabold shadow-[inset_0_-5px_0_0_var(--trip)]" : "text-ink-2")}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
