import { Icon } from "./Icon";

/** Small integer input with big − / + buttons. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-bold">{label}</span>
      <div className="flex items-center border-2 border-ink bg-surface">
        <button
          type="button"
          aria-label={`${label} −`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-11 place-items-center disabled:opacity-35"
        >
          <span aria-hidden="true" className="text-2xl font-bold leading-none">−</span>
        </button>
        <output aria-live="polite" className="w-9 text-center text-lg font-extrabold tabular-nums">
          {value}
        </output>
        <button
          type="button"
          aria-label={`${label} +`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid size-11 place-items-center disabled:opacity-35"
        >
          <Icon name="plus" size={20} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
