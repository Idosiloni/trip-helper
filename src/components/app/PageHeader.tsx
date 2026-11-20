import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** Top bar for screens outside a trip: back chevron, big display title, optional end slot. */
export function PageHeader({ title, backHref, backLabel, end }: { title: string; backHref?: string; backLabel?: string; end?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-paper px-3 pb-2">
      <div className="mx-auto flex max-w-xl items-center gap-1">
        {backHref ? (
          <Link href={backHref} aria-label={backLabel} className="grid size-11 shrink-0 place-items-center active:bg-surface-2">
            {/* Chevron points right (= back) in RTL */}
            <Icon name="back" className="rtl:-scale-x-100" strokeWidth={2.5} />
          </Link>
        ) : null}
        <h1 className="display print-offset flex-1 truncate px-1 pt-1 text-[2.75rem]">{title}</h1>
        {end}
      </div>
    </header>
  );
}
