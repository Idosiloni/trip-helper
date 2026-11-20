import type { ReactNode } from "react";
import { cn } from "./cn";

/** A small rotated, outlined label, like an ink stamp. */
export function Stamp({ children, tone = "trip", tilt = -5, className }: { children: ReactNode; tone?: "trip" | "ink" | "muted"; tilt?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block border-2 px-2 py-0.5 text-xs font-extrabold whitespace-nowrap",
        tone === "trip" && "border-trip-ink text-trip-ink",
        tone === "ink" && "border-ink text-ink",
        tone === "muted" && "border-ink-2 text-ink-2",
        className,
      )}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </span>
  );
}
