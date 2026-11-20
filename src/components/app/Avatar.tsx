import { cn } from "@/components/ui/cn";
import { ON_PALETTE } from "@/lib/theme";

export function Avatar({ name, color, size = 40, className }: { name: string; color: string; size?: number; className?: string }) {
  const initial = Array.from(name.trim())[0] ?? "?";
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full font-extrabold", className)}
      style={{ backgroundColor: color, color: ON_PALETTE, width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </span>
  );
}
