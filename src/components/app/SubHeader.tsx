import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/** Title row for a sub-screen inside a trip (settings, import, trash...). */
export function SubHeader({ title, backHref, backLabel, end }: { title: string; backHref: string; backLabel: string; end?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1">
      <Link href={backHref} aria-label={backLabel} className="-ms-3 grid size-11 shrink-0 place-items-center active:bg-surface-2">
        <Icon name="back" className="rtl:-scale-x-100" strokeWidth={2.5} />
      </Link>
      <h2 className="display print-offset flex-1 pt-1 text-[3rem]">{title}</h2>
      {end}
    </div>
  );
}
