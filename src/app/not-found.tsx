import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pt-safe pb-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-10">
      <h1 className="display print-offset text-[4.5rem]">אין כאן כלום</h1>
      <p className="text-lg text-ink-2">הכתובת לא קיימת, או שהמסך הועבר.</p>
      <Link href="/trips" className="flex min-h-12 items-center justify-center bg-ink px-4 text-lg font-extrabold text-on-ink">
        לרשימת הטיולים
      </Link>
    </main>
  );
}
