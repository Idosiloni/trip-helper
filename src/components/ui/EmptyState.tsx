import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** A dashed "perforated" box: icon, display title, short body, one action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-start gap-3 overflow-hidden border-2 border-dashed border-ink bg-surface px-5 py-6">
      <span aria-hidden="true" className="halftone absolute -start-8 -top-8 size-28 rounded-full opacity-40" />
      <Icon name={icon} size={30} className="relative" />
      <h2 className="display print-offset relative text-[2.75rem]">{title}</h2>
      {body ? <p className="relative max-w-xs text-ink-2">{body}</p> : null}
      {action ? <div className="relative mt-1">{action}</div> : null}
    </div>
  );
}
