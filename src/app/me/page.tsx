import type { Metadata } from "next";
import { MeScreen } from "@/features/me/MeScreen";

export const metadata: Metadata = { title: "הפרופיל שלי" };

export default function MePage() {
  return <MeScreen />;
}
