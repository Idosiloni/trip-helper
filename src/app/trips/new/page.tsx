import type { Metadata } from "next";
import { NewTripWizard } from "@/features/setup/NewTripWizard";

export const metadata: Metadata = { title: "טיול חדש" };

export default function NewTripPage() {
  return <NewTripWizard />;
}
