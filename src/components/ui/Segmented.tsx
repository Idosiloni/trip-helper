import { useId } from "react";
import { cn } from "./cn";

/** Text options with a thick trip-colored underline on the chosen one. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      <div className="flex gap-6 border-b-2 border-ink">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center text-base transition-colors",
              o.value === value ? "font-extrabold text-ink shadow-[inset_0_-5px_0_0_var(--trip)]" : "text-ink-2",
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
