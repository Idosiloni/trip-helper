import type { Metadata } from "next";
import { TripsHome } from "@/features/trips/TripsHome";

export const metadata: Metadata = { title: "הטיולים שלי" };

export default function TripsPage() {
  return <TripsHome />;
}
