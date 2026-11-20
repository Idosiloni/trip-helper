import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordScreen } from "@/features/me/ResetPasswordScreen";

export const metadata: Metadata = { title: "סיסמה חדשה" };

export default function ResetPage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <Suspense>
        <ResetPasswordScreen />
      </Suspense>
    </main>
  );
}
