import type { Metadata } from "next";
import { Suspense } from "react";
import { WelcomeForm } from "@/features/me/WelcomeForm";

export const metadata: Metadata = { title: "נעים להכיר" };

export default function WelcomePage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <Suspense>
        <WelcomeForm />
      </Suspense>
    </main>
  );
}
