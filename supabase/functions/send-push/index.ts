// send-push: called every minute by pg_cron (push_tick) when notifications are due.
// Claims the batch from the database (the shared secret is checked there),
// sends Web Push (VAPID) and reports endpoints that are gone (404/410).
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

type Message = {
  title: string;
  body: string;
  url: string;
  tag: string;
  urgent: boolean;
  subscriptions: { endpoint: string; keys: { p256dh: string; auth: string } }[];
};

const SITE = Deno.env.get("PUSH_SITE_URL") ?? "https://tripplanner-pi-eight.vercel.app";

let appServer: webpush.ApplicationServer | null = null;
async function server() {
  if (!appServer) {
    const keys = JSON.parse(Deno.env.get("VAPID_KEYS") ?? "null");
    if (!keys) throw new Error("VAPID_KEYS is not set");
    appServer = await webpush.ApplicationServer.new({
      contactInformation: SITE,
      vapidKeys: await webpush.importVapidKeys(keys, { extractable: false }),
    });
  }
  return appServer;
}

Deno.serve(async (req) => {
  const secret = req.headers.get("x-push-secret");
  if (req.method !== "POST" || !secret) return new Response("not allowed", { status: 403 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db.rpc("claim_push_batch", { p_secret: secret });
  if (error) return new Response("not allowed", { status: 403 });

  const batch = (data ?? []) as Message[];
  if (batch.length === 0) return Response.json({ sent: 0 });

  const as = await server();
  const gone: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    batch.flatMap((m) =>
      m.subscriptions.map(async (sub) => {
        const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag });
        try {
          await as.subscribe(sub).pushTextMessage(payload, {
            urgency: m.urgent ? webpush.Urgency.High : webpush.Urgency.Normal,
            ttl: 60 * 60 * 12,
          });
          sent++;
        } catch (e) {
          failed++;
          if (e instanceof webpush.PushMessageError && (e.response.status === 404 || e.response.status === 410)) {
            gone.push(sub.endpoint);
          } else {
            console.error("push failed", e instanceof webpush.PushMessageError ? e.response.status : String(e));
          }
        }
      }),
    ),
  );
  if (gone.length) await db.rpc("push_report", { p_secret: secret, p_gone: gone });
  return Response.json({ sent, failed, gone: gone.length });
});
