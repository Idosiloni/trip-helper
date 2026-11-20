import { useId, type SelectHTMLAttributes } from "react";

/** Native select (best on phones), styled to match TextField. */
export function Select({ label, options, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: ReadonlyArray<{ value: string; label: string }> }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <select id={id} className="min-h-12 w-full border-2 border-ink bg-surface px-3 text-base text-ink" {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
