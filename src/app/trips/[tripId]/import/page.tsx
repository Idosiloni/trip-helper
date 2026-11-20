import { Suspense } from "react";
import { ImportScreen } from "@/features/import/ImportScreen";

export default function ImportPage() {
  return (
    <Suspense>
      <ImportScreen />
    </Suspense>
  );
}
