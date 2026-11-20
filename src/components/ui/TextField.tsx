import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export function TextField({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-12 w-full border-2 bg-surface px-3 text-lg text-ink placeholder:text-ink-3",
          "focus:border-focus focus:outline-none",
          error ? "border-danger" : "border-ink",
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
