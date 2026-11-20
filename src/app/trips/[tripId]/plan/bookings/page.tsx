import { Suspense } from "react";
import { BookingsScreen } from "@/features/itinerary/BookingsScreen";

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsScreen />
    </Suspense>
  );
}
