import { notFound } from "next/navigation";
import { UiGallery } from "./UiGallery";

// Component gallery for development only (PLAN 0.6).
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
