import { cn } from "./cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent opacity-70"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
