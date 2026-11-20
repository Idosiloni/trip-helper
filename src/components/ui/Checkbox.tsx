import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

/** Square ink checkbox with a 44px hit area (used by tasks and packing in phase 1). */
export function Checkbox({ label, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex min-h-12 cursor-pointer items-center gap-3 has-[:checked]:text-ink-3 has-[:checked]:line-through", className)}>
      <span className="grid size-11 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          className="peer col-start-1 row-start-1 size-[26px] cursor-pointer appearance-none border-[2.5px] border-ink bg-surface checked:bg-ink"
          {...props}
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none col-start-1 row-start-1 hidden size-4 text-on-ink peer-checked:block"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
        >
          <path d="M4 12.5l5 5L20 7" />
        </svg>
      </span>
      <span className="text-[17px]">{label}</span>
    </label>
  );
}
