import { Suspense } from "react";
import { PlacesScreen } from "@/features/places/PlacesScreen";

export default function PlacesPage() {
  return (
    <Suspense>
      <PlacesScreen />
    </Suspense>
  );
}
