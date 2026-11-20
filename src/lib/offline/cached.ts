// Network-first reads that fall back to the copy on this device when offline.
import { supabase } from "@/lib/supabase/client";
import { kv } from "./kv";
import { isNetworkError } from "./outbox";

async function sessionUserId() {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? "";
}

/** Runs `load`; on success saves the result under `name`, on a network failure returns the saved copy. */
export async function withDeviceCopy<T>(name: string, load: () => Promise<T>): Promise<T> {
  const uid = await sessionUserId();
  try {
    const fresh = await load();
    if (uid) void kv().set(`${name}:${uid}`, fresh);
    return fresh;
  } catch (e) {
    if (uid && isNetworkError(e as { message?: string; code?: string })) {
      const saved = await kv().get<T>(`${name}:${uid}`);
      if (saved !== undefined) return saved;
    }
    throw e;
  }
}

/** Sign-out on a shared device: nothing of this user stays behind. */
export async function clearDeviceData() {
  try {
    await kv().clear();
  } catch {}
  try {
    if (typeof caches !== "undefined") {
      for (const name of await caches.keys()) if (name.startsWith("th-")) await caches.delete(name);
    }
  } catch {}
}
