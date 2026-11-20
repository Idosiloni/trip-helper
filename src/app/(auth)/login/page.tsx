import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/me/LoginForm";

export const metadata: Metadata = { title: "כניסה" };

export default function LoginPage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
