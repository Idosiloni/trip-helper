import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinScreen } from "@/features/setup/JoinScreen";

export const metadata: Metadata = { title: "הצטרפות לטיול" };

export default function JoinPage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <Suspense>
        <JoinScreen />
      </Suspense>
    </main>
  );
}
