import { useId } from "react";
import { ON_PALETTE, PALETTE } from "@/lib/theme";
import { cn } from "./cn";
import { Icon } from "./Icon";

/** Square ink swatches; the chosen one gets a check and an offset ink frame. */
export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {PALETTE.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <label
              key={color}
              className={cn(
                "relative grid size-11 cursor-pointer place-items-center transition-transform",
                selected ? "outline-[3px] outline-offset-[3px] outline-ink outline" : "active:scale-95",
              )}
              style={{ backgroundColor: color }}
            >
              <input
                type="radio"
                name={name}
                value={color}
                checked={selected}
                onChange={() => onChange(color)}
                className="sr-only"
                aria-label={color}
              />
              {selected ? <Icon name="check" size={22} strokeWidth={3.5} style={{ color: ON_PALETTE }} /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
