-- Phase 2b: push notifications (SPEC §12).
--
-- Flow: triggers and push_tick() write rows to notification_queue (one row per
-- recipient). pg_cron runs push_tick() every minute; when something is due it
-- calls the `send-push` Edge Function through pg_net. The function calls
-- claim_push_batch(secret), which groups rows per user+trip, respects quiet
-- hours, marks them sent and returns what to send.

-- ---------------------------------------------------------------------------
-- Private config (not exposed through the API). The secret shared with the
-- Edge Function is generated here and never leaves the database except in
-- the pg_net request header.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.config (
  key   text primary key,
  value text not null
);
revoke all on private.config from public, anon, authenticated;

insert into private.config (key, value)
values ('push_secret', md5(gen_random_uuid()::text || clock_timestamp()::text) || md5(gen_random_uuid()::text)),
       ('functions_url', 'https://afmorqqqazmosafzvusu.supabase.co/functions/v1')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null unique check (endpoint ~ '^https://\S+$' and char_length(endpoint) <= 1000),
  p256dh       text not null check (char_length(p256dh) <= 200),
  auth         text not null check (char_length(auth) <= 100),
  tz           text check (char_length(tz) <= 64),   -- device zone, refreshed when the app opens
  user_agent   text check (char_length(user_agent) <= 300),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: own read" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_subscriptions: own delete" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
-- Insert/update only through save_push_subscription() (a shared device may switch users).

create table public.notification_settings (
  user_id       uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  kinds         jsonb not null default '{}' check (jsonb_typeof(kinds) = 'object'), -- {"done": false, ...}; missing = on
  quiet_enabled boolean not null default true,
  quiet_start   time not null default '22:00',
  quiet_end     time not null default '07:00',
  updated_at    timestamptz not null default now()
);
create trigger notification_settings_set_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

alter table public.notification_settings enable row level security;
create policy "notification_settings: own read" on public.notification_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notification_settings: own insert" on public.notification_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "notification_settings: own update" on public.notification_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.notification_queue (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  trip_id    uuid not null references public.trips (id) on delete cascade,
  kind       text not null,          -- assigned | done | import | joined | bookings | reminders | test
  body       text not null check (char_length(body) <= 300),
  url        text not null,
  urgent     boolean not null default false,   -- goes out during quiet hours (flight reminders)
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  send_after timestamptz not null default now() + interval '60 seconds',
  sent_at    timestamptz
);
create index notification_queue_pending_idx on public.notification_queue (send_after) where sent_at is null;

alter table public.notification_queue enable row level security;  -- no policies: server only
revoke all on public.notification_queue from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The zone a user's phone was last in (falls back to the profile zone).
create or replace function public.user_tz(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.tz from public.push_subscriptions s where s.user_id = p_user and s.tz is not null
      order by s.last_seen_at desc limit 1),
    (select p.timezone from public.profiles p where p.id = p_user),
    'Asia/Jerusalem');
$$;

create or replace function public.in_quiet_hours(p_user uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
             when not s.quiet_enabled or s.quiet_start = s.quiet_end then false
             when s.quiet_start < s.quiet_end then (p_at at time zone public.user_tz(p_user))::time >= s.quiet_start
                                                and (p_at at time zone public.user_tz(p_user))::time < s.quiet_end
             else (p_at at time zone public.user_tz(p_user))::time >= s.quiet_start
               or (p_at at time zone public.user_tz(p_user))::time < s.quiet_end
           end
      from public.notification_settings s where s.user_id = p_user),
    -- No settings row yet: default quiet hours 22:00–07:00.
    (p_at at time zone public.user_tz(p_user))::time >= '22:00' or (p_at at time zone public.user_tz(p_user))::time < '07:00');
$$;

-- One recipient, one event. Skips: the actor, non-members, users without a
-- device, muted trips, kinds the user turned off, duplicates.
create or replace function public.enqueue_notification(
  p_user uuid,
  p_trip uuid,
  p_kind text,
  p_body text,
  p_url text,
  p_dedupe text default null,
  p_urgent boolean default false,
  p_delay interval default interval '60 seconds'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_user is not distinct from (select auth.uid()) and p_kind <> 'test' then
    return;
  end if;
  if not exists (select 1 from public.push_subscriptions where user_id = p_user) then
    return;
  end if;
  if not exists (select 1 from public.trip_members m
                  where m.trip_id = p_trip and m.user_id = p_user
                    and coalesce((m.notification_prefs->>'muted')::boolean, false) = false) then
    return;
  end if;
  if p_kind <> 'test' and exists (select 1 from public.notification_settings s
                                    where s.user_id = p_user and (s.kinds->>p_kind) = 'false') then
    return;
  end if;
  insert into public.notification_queue (user_id, trip_id, kind, body, url, urgent, dedupe_key, send_after)
  values (p_user, p_trip, p_kind, left(p_body, 300), p_url, p_urgent, p_dedupe, now() + p_delay)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- Everyone in the trip except the actor.
create or replace function public.enqueue_for_trip(p_trip uuid, p_kind text, p_body text, p_url text, p_dedupe text default null, p_urgent boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r record;
begin
  for r in select user_id from public.trip_members where trip_id = p_trip loop
    perform public.enqueue_notification(r.user_id, p_trip, p_kind, p_body, p_url,
      case when p_dedupe is null then null else p_dedupe || ':' || r.user_id end, p_urgent);
  end loop;
end;
$$;

create or replace function public.actor_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim((select display_name from public.profiles where id = p_user)), ''), 'מישהו מהמשפחה');
$$;

revoke execute on function public.user_tz(uuid), public.in_quiet_hours(uuid, timestamptz),
  public.enqueue_notification(uuid, uuid, text, text, text, text, boolean, interval),
  public.enqueue_for_trip(uuid, text, text, text, text, boolean), public.actor_name(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Events from the activity feed
-- ---------------------------------------------------------------------------
create or replace function public.activity_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := '/trips/' || new.trip_id;
  who  text := public.actor_name(new.actor_id);
  t    public.tasks;
  n    int;
  word text;
  linked uuid;
begin
  if new.type = 'task.done' then
    select * into t from public.tasks where id = new.entity_id;
    if found then
      select linked_user_id into linked from public.travelers where id = t.assignee_traveler_id;
      perform public.enqueue_notification(t.created_by, new.trip_id, 'done',
        'בוצע: ' || t.title || ' (' || who || ')', base || '/lists/tasks');
      if linked is distinct from t.created_by then
        perform public.enqueue_notification(linked, new.trip_id, 'done',
          'בוצע: ' || t.title || ' (' || who || ')', base || '/lists/tasks');
      end if;
    end if;

  elsif new.type = 'import.committed' then
    n := coalesce((new.payload->>'count')::int, 0);
    if n > 0 then
      word := case new.payload->>'kind'
                when 'tasks' then 'משימות'
                when 'packing' then 'פריטי ציוד'
                when 'places' then 'מקומות'
                when 'itinerary' then 'פריטים למסלול'
                else 'פריטים' end;
      perform public.enqueue_for_trip(new.trip_id, 'import',
        who || ': נוספו ' || n || ' ' || word,
        base || case new.payload->>'kind'
                  when 'tasks' then '/lists/tasks'
                  when 'packing' then '/lists/packing'
                  when 'places' then '/places'
                  when 'itinerary' then '/plan'
                  else '/activity' end);
    end if;

  elsif new.type = 'member.joined' then
    perform public.enqueue_for_trip(new.trip_id, 'joined', who || ' הצטרפ/ה לטיול', base || '/activity');

  elsif new.type = 'booking.created' then
    perform public.enqueue_for_trip(new.trip_id, 'bookings',
      'הזמנה חדשה: ' || coalesce(new.payload->>'title', ''), base || '/plan/bookings');
  end if;
  return null;
end;
$$;

create trigger activity_notify after insert on public.activity
  for each row execute function public.activity_notify();

-- Assignment: a new task with an assignee, or a changed assignee.
create or replace function public.tasks_notify_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare linked uuid;
begin
  if public.in_bulk_write() or new.assignee_traveler_id is null or new.deleted_at is not null or new.done then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.assignee_traveler_id is not distinct from old.assignee_traveler_id then
    return null;
  end if;
  select linked_user_id into linked from public.travelers where id = new.assignee_traveler_id and deleted_at is null;
  perform public.enqueue_notification(linked, new.trip_id, 'assigned',
    'משימה בשבילך: ' || new.title || ' (' || public.actor_name((select auth.uid())) || ')',
    '/trips/' || new.trip_id || '/lists/tasks');
  return null;
end;
$$;

create trigger tasks_notify_assigned after insert or update of assignee_traveler_id on public.tasks
  for each row execute function public.tasks_notify_assigned();

-- ---------------------------------------------------------------------------
-- Reminders (run every minute from push_tick). Each has a dedupe key that
-- includes the time it is about, so a moved booking/due date reminds again.
-- A 30-minute catch-up window covers a missed tick; past events are skipped.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  who uuid;
  local_time text;
begin
  -- Tasks with an explicit reminder time.
  for r in
    select k.* from public.tasks k join public.trips tr on tr.id = k.trip_id
     where k.remind_at between now() - interval '30 minutes' and now()
       and not k.done and k.deleted_at is null and tr.deleted_at is null
  loop
    who := coalesce((select linked_user_id from public.travelers where id = r.assignee_traveler_id), r.created_by);
    perform public.enqueue_notification(who, r.trip_id, 'reminders', 'תזכורת: ' || r.title,
      '/trips/' || r.trip_id || '/lists/tasks', 'remind:' || r.id || ':' || extract(epoch from r.remind_at)::bigint,
      false, interval '0');
  end loop;

  -- Tasks due at a set time: one hour before.
  for r in
    select k.* from public.tasks k join public.trips tr on tr.id = k.trip_id
     where not k.due_all_day and k.due_at is not null
       and k.due_at - interval '1 hour' between now() - interval '30 minutes' and now()
       and k.due_at > now()
       and not k.done and k.deleted_at is null and tr.deleted_at is null
  loop
    who := coalesce((select linked_user_id from public.travelers where id = r.assignee_traveler_id), r.created_by);
    perform public.enqueue_notification(who, r.trip_id, 'reminders', 'בעוד שעה: ' || r.title,
      '/trips/' || r.trip_id || '/lists/tasks', 'due:' || r.id || ':' || extract(epoch from r.due_at)::bigint,
      false, interval '0');
  end loop;

  -- All-day tasks: the morning of the due date (09:00–11:59 in the recipient's zone).
  for r in
    select k.*, coalesce((select linked_user_id from public.travelers where id = k.assignee_traveler_id), k.created_by) as recipient
      from public.tasks k join public.trips tr on tr.id = k.trip_id
     where k.due_all_day and k.due_at is not null
       and k.due_at between now() - interval '2 days' and now() + interval '2 days'
       and not k.done and k.deleted_at is null and tr.deleted_at is null
  loop
    continue when r.recipient is null;
    if (r.due_at at time zone public.user_tz(r.recipient))::date = (now() at time zone public.user_tz(r.recipient))::date
       and extract(hour from now() at time zone public.user_tz(r.recipient)) between 9 and 11 then
      perform public.enqueue_notification(r.recipient, r.trip_id, 'reminders', 'להיום: ' || r.title,
        '/trips/' || r.trip_id || '/lists/tasks', 'dueday:' || r.id || ':' || (r.due_at at time zone public.user_tz(r.recipient))::date,
        false, interval '0');
    end if;
  end loop;

  -- Bookings: flights 24h (check-in) and 3h (leave for the airport) before; others 2h before.
  for r in
    select b.*, l.lead, l.label, l.urgent
      from public.bookings b
      join public.trips tr on tr.id = b.trip_id
      cross join lateral (values
        (interval '24 hours', 'מחר טיסה', false, b.kind = 'flight'),
        (interval '3 hours',  'בעוד 3 שעות טיסה. זמן לצאת לשדה', true, b.kind = 'flight'),
        (interval '2 hours',  'בעוד שעתיים', false, b.kind <> 'flight')
      ) as l(lead, label, urgent, applies)
     where l.applies and b.starts_at is not null and b.deleted_at is null and tr.deleted_at is null
       and b.starts_at - l.lead between now() - interval '30 minutes' and now()
       and b.starts_at > now()
  loop
    local_time := to_char(r.starts_at at time zone coalesce(r.starts_tz, 'Asia/Jerusalem'), 'HH24:MI');
    perform public.enqueue_for_trip(r.trip_id, 'bookings',
      r.label || ': ' || r.title || ' (' || local_time || ')',
      '/trips/' || r.trip_id || '/plan/bookings',
      'booking:' || r.id || ':' || extract(epoch from r.lead)::bigint || ':' || extract(epoch from r.starts_at)::bigint,
      r.urgent);
  end loop;
end;
$$;

revoke execute on function public.enqueue_reminders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Claim: called by the Edge Function with the shared secret.
-- Groups due rows per user+trip once the burst has settled (newest row older
-- than 45s, or oldest older than 5 min); quiet hours hold non-urgent rows.
-- ---------------------------------------------------------------------------
create or replace function public.claim_push_batch(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_secret is null or p_secret is distinct from (select value from private.config where key = 'push_secret') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with due as (
    select q.*
      from public.notification_queue q
     where q.sent_at is null and q.send_after <= now()
       and (q.urgent or not public.in_quiet_hours(q.user_id))
  ),
  groups as (
    select user_id, trip_id
      from due
     group by user_id, trip_id
    having max(created_at) < now() - interval '45 seconds' or min(created_at) < now() - interval '5 minutes'
        or bool_or(urgent) or bool_or(kind = 'test')
  ),
  claimed as (
    update public.notification_queue q set sent_at = now()
      from due d join groups g on g.user_id = d.user_id and g.trip_id = d.trip_id
     where q.id = d.id
    returning q.*
  ),
  msgs as (
    select c.user_id, c.trip_id,
           count(*) as n,
           (array_agg(c.body order by c.created_at))[1:3] as bodies,
           (array_agg(c.url order by c.created_at))[1] as first_url,
           bool_or(c.urgent) as urgent
      from claimed c
     group by c.user_id, c.trip_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', t.name,
           'body', case when m.n = 1 then m.bodies[1]
                        else m.n || ' עדכונים: ' || array_to_string(m.bodies, ' · ')
                             || case when m.n > 3 then ' ועוד' else '' end end,
           'url', case when m.n = 1 then m.first_url else '/trips/' || m.trip_id || '/activity' end,
           'tag', 'trip-' || m.trip_id,
           'urgent', m.urgent,
           'subscriptions', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys',
                                     jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth))), '[]'::jsonb)
                               from public.push_subscriptions s where s.user_id = m.user_id)
         )), '[]'::jsonb)
    into result
    from msgs m join public.trips t on t.id = m.trip_id;

  return result;
end;
$$;

-- Endpoints the push service says are gone (404/410) are removed.
create or replace function public.push_report(p_secret text, p_gone text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.config where key = 'push_secret') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
end;
$$;

revoke execute on function public.claim_push_batch(text), public.push_report(text, text[]) from public, anon, authenticated;
grant execute on function public.claim_push_batch(text), public.push_report(text, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- App-facing RPCs
-- ---------------------------------------------------------------------------

-- Upsert by endpoint: a shared device that switches users moves to the new user.
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
end;
$$;

-- Called when the app opens: refreshes the device zone (travel changes it).
create or replace function public.touch_push_subscription(p_endpoint text, p_tz text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with u as (
    update public.push_subscriptions set tz = coalesce(nullif(p_tz, ''), tz), last_seen_at = now()
     where endpoint = p_endpoint and user_id = (select auth.uid())
    returning 1
  )
  select exists (select 1 from u);
$$;

-- "Send a test notification" from the Me screen. Goes out within a minute.
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

revoke execute on function public.save_push_subscription(text, text, text, text, text),
  public.touch_push_subscription(text, text), public.send_test_notification() from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text),
  public.touch_push_subscription(text, text), public.send_test_notification() to authenticated;

-- ---------------------------------------------------------------------------
-- The per-minute tick. Without pg_net (local checks) it only prepares the queue.
-- ---------------------------------------------------------------------------
create or replace function public.push_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.enqueue_reminders();
  delete from public.notification_queue where sent_at < now() - interval '7 days';
  delete from public.notification_queue where sent_at is null and created_at < now() - interval '2 days';

  if exists (select 1 from public.notification_queue where sent_at is null and send_after <= now())
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    execute 'select net.http_post(url := $1, headers := $2, body := ''{}''::jsonb, timeout_milliseconds := 20000)'
      using (select value from private.config where key = 'functions_url') || '/send-push',
            jsonb_build_object('Content-Type', 'application/json',
                               'x-push-secret', (select value from private.config where key = 'push_secret'));
  end if;
end;
$$;

revoke execute on function public.push_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron;
    perform cron.schedule('push-tick', '* * * * *', 'select public.push_tick()');
  end if;
end;
$$;
