"use client";

import Link from "next/link";
import { useEffect } from "react";

// Plain strings: this boundary may render when translations themselves failed.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10">
      <h1 className="display print-offset text-[4.5rem]">משהו השתבש</h1>
      <p className="text-lg text-ink-2">המסך הזה לא נטען. הנתונים שלכם שמורים. אפשר לנסות שוב, או לחזור לרשימת הטיולים.</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => retry()} className="min-h-12 flex-1 bg-ink px-4 text-lg font-extrabold text-on-ink">
          לנסות שוב
        </button>
        <Link href="/trips" className="flex min-h-12 flex-1 items-center justify-center border-2 border-ink bg-surface px-4 font-bold">
          כל הטיולים
        </Link>
      </div>
    </main>
  );
}
