import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

// Direction D: square corners. Primary is solid ink with an offset "print"
// shadow in the trip tint; secondary is paper with a 2px ink border.
const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-on-ink shadow-[4px_4px_0_0_var(--trip-tint)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_var(--trip-tint)]",
  secondary: "bg-surface text-ink border-2 border-ink active:bg-surface-2",
  ghost: "bg-transparent text-ink underline-offset-4 active:bg-surface-2",
  danger: "bg-transparent text-danger border-2 border-current active:bg-surface-2",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-6 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  block = false,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-bold transition-[transform,box-shadow,background-color] duration-100",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
