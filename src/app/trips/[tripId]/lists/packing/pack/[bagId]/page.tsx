import { Suspense } from "react";
import { PackModeScreen } from "@/features/lists/PackModeScreen";

export default function PackModePage() {
  return (
    <Suspense>
      <PackModeScreen />
    </Suspense>
  );
}
