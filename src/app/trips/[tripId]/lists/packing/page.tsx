import { Suspense } from "react";
import { PackingScreen } from "@/features/lists/PackingScreen";

export default function PackingPage() {
  return (
    <Suspense>
      <PackingScreen />
    </Suspense>
  );
}
