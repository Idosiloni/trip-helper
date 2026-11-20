import { useId } from "react";

/** On/off switch with a visible label and optional hint. */
export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-[15px] font-bold">{label}</span>
        {hint ? <span className="text-sm text-ink-2">{hint}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-8 w-14 border-2 border-ink bg-surface transition-colors peer-checked:bg-ink peer-focus-visible:outline-[3px] peer-focus-visible:outline-focus" />
        <span className="absolute top-1 size-6 bg-ink transition-[inset-inline-start] start-1 peer-checked:start-7 peer-checked:bg-on-ink" />
      </span>
    </label>
  );
}
