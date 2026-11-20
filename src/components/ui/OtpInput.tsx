"use client";

import { useId } from "react";
import { cn } from "./cn";

/**
 * One real <input> (so iOS/Android "from Messages/Mail" autofill and paste work)
 * drawn as six boxes. Digits are always left-to-right, even in RTL.
 */
export function OtpInput({
  label,
  value,
  onChange,
  length = 6,
  error,
  disabled,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div dir="ltr" className="relative mx-auto">
        <div aria-hidden="true" className="flex gap-2">
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cn(
                "grid h-14 w-11 place-items-center border-2 bg-surface text-2xl font-extrabold tabular-nums",
                error ? "border-danger" : i === value.length ? "border-focus border-[3px]" : "border-ink",
              )}
            >
              {value[i] ?? ""}
            </span>
          ))}
        </div>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error || undefined}
          className="absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 focus:outline-none"
        />
      </div>
    </div>
  );
}
