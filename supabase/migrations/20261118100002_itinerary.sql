-- Phase 2: days, stops (SPEC 6.6) and bookings (SPEC 6.7).

create type public.time_of_day as enum ('morning', 'noon', 'evening');
create type public.booking_kind as enum ('flight', 'hotel', 'train', 'attraction', 'car', 'other');

create table public.trip_days (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips (id) on delete cascade,
  date             date not null,
  city             text check (char_length(city) <= 60),
  title            text check (char_length(title) <= 80),
  notes            text check (char_length(notes) <= 2000),
  lodging_place_id uuid,
  flexible         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (trip_id, date),
  unique (id, trip_id),
  foreign key (lodging_place_id, trip_id) references public.places (id, trip_id) on delete set null (lodging_place_id)
);

create table public.stops (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  day_id         uuid,                       -- null = not scheduled yet
  place_id       uuid,
  free_text      text check (char_length(free_text) <= 200),
  time_of_day    public.time_of_day,
  start_time     time,
  duration_min   int check (duration_min between 5 and 1440),
  transport_note text check (char_length(transport_note) <= 300),
  notes          text check (char_length(notes) <= 2000),
  source         public.item_source not null default 'manual',
  ai_import_id   uuid references public.ai_imports (id) on delete set null,
  position       text collate "C" not null,
  deleted_at     timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (day_id, trip_id) references public.trip_days (id, trip_id) on delete set null (day_id),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete set null (place_id),
  check (place_id is not null or nullif(trim(free_text), '') is not null)
);

create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips (id) on delete cascade,
  kind              public.booking_kind not null default 'other',
  title             text not null check (char_length(title) between 1 and 120),
  starts_at         timestamptz,
  starts_tz         text check (char_length(starts_tz) <= 64),
  ends_at           timestamptz,
  ends_tz           text check (char_length(ends_tz) <= 64),
  confirmation_code text check (char_length(confirmation_code) <= 60), -- never sent in prompts
  link              text check (link is null or link ~* '^https?://\S+$'),
  place_id          uuid,
  notes             text check (char_length(notes) <= 2000),
  deleted_at        timestamptz,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete set null (place_id),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index trip_days_trip_idx on public.trip_days (trip_id);
create index stops_trip_idx on public.stops (trip_id);
create index bookings_trip_idx on public.bookings (trip_id);

create trigger trip_days_set_updated_at before update on public.trip_days for each row execute function public.set_updated_at();
create trigger stops_set_updated_at before update on public.stops for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Days follow the trip dates. Days that fall out of range lose nothing:
-- their stops move to "not scheduled" (day_id null) before the day is removed.
-- A new day's city comes from the profile's city dates when they cover it.
-- ---------------------------------------------------------------------------
create or replace function public.sync_trip_days(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.trips;
  last_day date;
begin
  select * into t from public.trips where id = p_trip_id;
  if not found then return; end if;

  if t.start_date is null then
    update public.stops set day_id = null where trip_id = p_trip_id and day_id is not null;
    delete from public.trip_days where trip_id = p_trip_id;
    return;
  end if;

  last_day := coalesce(t.end_date, t.start_date);
  update public.stops s set day_id = null
   from public.trip_days d
   where s.day_id = d.id and d.trip_id = p_trip_id and (d.date < t.start_date or d.date > last_day);
  delete from public.trip_days where trip_id = p_trip_id and (date < t.start_date or date > last_day);

  insert into public.trip_days (trip_id, date, city)
  select p_trip_id, g::date,
         (select c->>'name'
            from jsonb_array_elements(coalesce(t.profile->'destinations', '[]'::jsonb)) dest,
                 jsonb_array_elements(coalesce(dest->'cities', '[]'::jsonb)) c
           where (c->>'from') ~ '^\d{4}-\d{2}-\d{2}$' and (c->>'to') ~ '^\d{4}-\d{2}-\d{2}$'
             and g::date between (c->>'from')::date and (c->>'to')::date
           limit 1)
  from generate_series(t.start_date, last_day, interval '1 day') g
  on conflict (trip_id, date) do nothing;
end;
$$;

revoke execute on function public.sync_trip_days(uuid) from public, anon, authenticated;

create or replace function public.trips_sync_days()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date then
    perform public.sync_trip_days(new.id);
  end if;
  return null;
end;
$$;

create trigger trips_sync_days after insert or update of start_date, end_date on public.trips
  for each row execute function public.trips_sync_days();

-- Existing trips get their days now.
do $$
declare r record;
begin
  for r in select id from public.trips loop
    perform public.sync_trip_days(r.id);
  end loop;
end;
$$;

-- Feed: new bookings (stops are too chatty to log one by one).
create or replace function public.bookings_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.trip_id, 'booking.created', 'booking', new.id, jsonb_build_object('title', new.title, 'kind', new.kind));
  end if;
  return null;
end;
$$;

create trigger bookings_activity after insert on public.bookings
  for each row execute function public.bookings_activity();

alter table public.trip_days enable row level security;
alter table public.stops enable row level security;
alter table public.bookings enable row level security;

-- Days are created by sync_trip_days(); editors may change city/title/lodging/notes/flexible.
create policy "trip_days: members read" on public.trip_days for select to authenticated using (public.is_trip_member(trip_id));
create policy "trip_days: editors update" on public.trip_days for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy "stops: members read" on public.stops for select to authenticated using (public.is_trip_member(trip_id));
create policy "stops: editors insert" on public.stops for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "stops: editors update" on public.stops for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy "bookings: members read" on public.bookings for select to authenticated using (public.is_trip_member(trip_id));
create policy "bookings: editors insert" on public.bookings for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "bookings: editors update" on public.bookings for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

-- Days never move between trips or change date by hand.
create or replace function public.trip_days_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (new.trip_id <> old.trip_id or new.date <> old.date) then
    raise exception 'day trip/date are managed by the trip dates' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trip_days_guard before update on public.trip_days
  for each row execute function public.trip_days_guard();

alter publication supabase_realtime add table public.places, public.trip_days, public.stops, public.bookings;
