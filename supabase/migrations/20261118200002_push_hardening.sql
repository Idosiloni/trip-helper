-- Push hardening: subscriptions may only point at real push services (so the
-- sender can't be used to POST to arbitrary URLs), at most 5 devices per user,
-- and one pending test notification at a time.

alter table public.push_subscriptions
  add constraint push_subscriptions_known_service check (
    endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)/'
  );

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_tz text default null, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, tz, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, nullif(p_tz, ''), left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        tz = coalesce(excluded.tz, public.push_subscriptions.tz),
        user_agent = excluded.user_agent, last_seen_at = now();
  -- Keep the 5 most recently used devices.
  delete from public.push_subscriptions
   where user_id = uid
     and id not in (select id from public.push_subscriptions where user_id = uid order by last_seen_at desc limit 5);
end;
$$;

create or replace function public.send_test_notification()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  any_trip uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.push_subscriptions where user_id = uid) then
    return false;
  end if;
  if exists (select 1 from public.notification_queue
              where user_id = uid and kind = 'test' and (sent_at is null or sent_at > now() - interval '30 seconds')) then
    return true;  -- one is already on its way
  end if;
  select m.trip_id into any_trip from public.trip_members m join public.trips t on t.id = m.trip_id
   where m.user_id = uid and t.deleted_at is null order by t.created_at desc limit 1;
  if any_trip is null then
    return false;
  end if;
  insert into public.notification_queue (user_id, trip_id, kind, body, url, urgent, send_after)
  values (uid, any_trip, 'test', 'התראת בדיקה. אם רואים אותה, ההתראות עובדות.', '/me', true, now());
  return true;
end;
$$;
