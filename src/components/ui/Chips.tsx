import { useId } from "react";
import { cn } from "./cn";

/** Multi-select chips (checkbox semantics), square and inked. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: readonly T[];
  onChange: (value: T[]) => void;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center border-2 border-ink px-3 text-[15px] font-bold transition-colors",
                on ? "bg-ink text-on-ink" : "bg-surface text-ink",
              )}
            >
              <input
                type="checkbox"
                name={id}
                className="sr-only"
                checked={on}
                onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
