// Web Push on this device (SPEC §12). Permission is asked only from a button.
import { supabase } from "@/lib/supabase/client";
import { registerServiceWorker } from "../offline/sw";

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function supported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && VAPID_PUBLIC_KEY !== "";
}

function deviceTz() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function keyBytes(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("service worker registration failed");
  return reg;
}

async function currentSubscription() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSubscription();
  if (!sub || Notification.permission !== "granted") return "off";
  // The row may be gone (another user signed in on this device, or 410 cleanup).
  const { data } = await supabase().rpc("touch_push_subscription", { p_endpoint: sub.endpoint, p_tz: deviceTz() ?? "" });
  return data ? "on" : "off";
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_tz: deviceTz(),
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Must run from a click (browsers and iOS require a user gesture). */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  await save(sub);
  return "on";
}

/** Turns push off on this device only. */
export async function disablePush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (sub) {
    await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}

/** Before signing out: this device should stop getting this user's notifications. */
export async function forgetDeviceOnSignOut() {
  try {
    const sub = await currentSubscription();
    if (sub) await supabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  } catch {
    // Signing out must not fail because of this.
  }
}

/** On app open: keeps the device time zone current (quiet hours, morning reminders). */
export async function refreshPushDevice() {
  try {
    if (!supported() || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub) await supabase().rpc("touch_push_subscription", { p_endpoint: sub.endpoint, p_tz: deviceTz() ?? "" });
  } catch {
    // Best effort.
  }
}

export async function sendTestNotification() {
  const { data, error } = await supabase().rpc("send_test_notification");
  if (error) throw error;
  return data === true;
}
