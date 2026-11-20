import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * The trip "ticket": a surface card with a 2px ink border, split by a dashed
 * perforation with half-circle notches cut into both edges.
 */
export function Ticket({ main, stub, className }: { main: ReactNode; stub?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative border-2 border-ink bg-surface", className)}>
      <div className="relative overflow-hidden">{main}</div>
      {stub ? (
        <>
          <div aria-hidden="true" className="relative mx-4 border-t-2 border-dashed border-ink">
            <span className="absolute -top-[11px] -start-[29px] size-5 rounded-full border-2 border-ink bg-paper [clip-path:inset(0_0_0_50%)] rtl:[clip-path:inset(0_50%_0_0)]" />
            <span className="absolute -top-[11px] -end-[29px] size-5 rounded-full border-2 border-ink bg-paper [clip-path:inset(0_50%_0_0)] rtl:[clip-path:inset(0_0_0_50%)]" />
          </div>
          <div>{stub}</div>
        </>
      ) : null}
    </div>
  );
}
