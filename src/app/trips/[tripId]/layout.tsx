import { Suspense } from "react";
import { TripShell } from "@/features/trips/TripShell";

export default function TripLayout({ children }: LayoutProps<"/trips/[tripId]">) {
  return (
    <Suspense>
      <TripShell>{children}</TripShell>
    </Suspense>
  );
}
