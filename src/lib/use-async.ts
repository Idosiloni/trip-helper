"use client";

import { useEffect, useEffectEvent, useState } from "react";

export type AsyncState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: Error };

/**
 * Minimal data loader for client screens: runs `load` whenever `key` changes
 * or `reload()` is called. Phase 1 replaces most uses with realtime-backed
 * stores; kept dependency-free on purpose.
 */
export function useAsync<T>(load: () => Promise<T>, key: string) {
  const [nonce, setNonce] = useState(0);
  const token = `${key}#${nonce}`;
  const [result, setResult] = useState<{ token: string; state: AsyncState<T> } | null>(null);
  const runLoad = useEffectEvent(load);

  useEffect(() => {
    let cancelled = false;
    runLoad().then(
      (data) => !cancelled && setResult({ token, state: { status: "ready", data } }),
      (error: unknown) =>
        !cancelled &&
        setResult({ token, state: { status: "error", error: error instanceof Error ? error : new Error(String(error)) } }),
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const state: AsyncState<T> = result?.token === token ? result.state : { status: "loading" };
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
