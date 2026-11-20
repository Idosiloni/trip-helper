"use client";

import { useEffect, useSyncExternalStore } from "react";

// Minimal global toasts, mainly for "deleted · undo" (SPEC §11).

type Toast = { id: number; message: string; actionLabel?: string; onAction?: () => void; duration: number };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(t: { message: string; actionLabel?: string; onAction?: () => void; duration?: number }) {
  const toast: Toast = { id: nextId++, duration: 5000, ...t };
  toasts = [...toasts.slice(-2), toast];
  emit();
  return toast.id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function ToastItem({ t }: { t: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration]);
  return (
    <div className="pointer-events-auto flex min-h-12 items-center gap-3 bg-ink px-4 py-2 text-on-ink shadow-[4px_4px_0_0_var(--trip-tint)]">
      <span className="flex-1 text-[15px]">{t.message}</span>
      {t.actionLabel ? (
        <button
          type="button"
          onClick={() => {
            t.onAction?.();
            dismissToast(t.id);
          }}
          className="min-h-11 px-2 font-extrabold underline underline-offset-4"
        >
          {t.actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ToastHost() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      {list.map((t) => (
        <div key={t.id} className="w-full max-w-xl">
          <ToastItem t={t} />
        </div>
      ))}
    </div>
  );
}
