"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Bottom sheet on a native <dialog> (focus trap, Escape and inert background
 * for free). Tap on the backdrop closes it.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  closeLabel,
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
  /** On a computer, a panel along the side (the page stays readable next to it) instead of a sheet from the bottom. */
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-ink/40 sm:mx-auto sm:max-w-xl ${side ? "lg:me-0 lg:ms-auto lg:mt-0 lg:h-dvh lg:max-h-dvh lg:max-w-xl lg:backdrop:bg-ink/20" : ""}`}
    >
      <div className={`pb-safe flex max-h-[92dvh] flex-col border-t-2 border-ink bg-paper text-ink ${side ? "lg:h-dvh lg:max-h-dvh lg:border-s-2 lg:border-t-0" : ""}`}>
        <div className="flex items-center gap-2 border-b-2 border-ink px-4 py-2">
          <h2 className="display flex-1 pt-1 text-[2.25rem]">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid size-11 place-items-center">
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </dialog>
  );
}
