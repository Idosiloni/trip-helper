import { Spinner } from "@/components/ui/Spinner";

export function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="grid flex-1 place-items-center py-20 text-ink-3">
      <Spinner label={label} className="[&>span:first-child]:size-8" />
    </div>
  );
}
