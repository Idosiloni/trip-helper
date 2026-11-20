-- Phase 2: places (SPEC 6.5) and a shared geocoding cache (SPEC 8.2).

create type public.place_category as enum ('food', 'attraction', 'shopping', 'nature', 'lodging', 'other');
create type public.place_status as enum ('want', 'visited', 'skipped');
create type public.place_priority as enum ('must', 'maybe');
create type public.geocode_status as enum ('pending', 'found', 'confirmed', 'not_found', 'manual');

create table public.places (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  category       public.place_category not null default 'attraction',
  city           text check (char_length(city) <= 60),
  area           text check (char_length(area) <= 60),
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  geocode_status public.geocode_status not null default 'pending',
  geocode_label  text check (char_length(geocode_label) <= 300),
  maps_url       text check (maps_url is null or maps_url ~* '^https://\S+$'),
  hours_text     text check (char_length(hours_text) <= 200),
  price_level    smallint check (price_level between 0 and 4),
  priority       public.place_priority not null default 'maybe',
  status         public.place_status not null default 'want',
  rating         smallint check (rating between 1 and 5),
  notes          text check (char_length(notes) <= 4000),
  source         public.item_source not null default 'manual',
  ai_import_id   uuid references public.ai_imports (id) on delete set null,
  position       text collate "C" not null,
  deleted_at     timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, trip_id),
  check ((lat is null) = (lng is null))
);

create index places_trip_idx on public.places (trip_id);
create trigger places_set_updated_at before update on public.places
  for each row execute function public.set_updated_at();

-- Viewers may mark visits and rate (a family member at the place), nothing else.
create or replace function public.places_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id <> old.trip_id then
    raise exception 'trip_id is immutable' using errcode = '42501';
  end if;
  if (select auth.uid()) is not null and public.my_trip_role(new.trip_id) = 'viewer'
     and (new.name, new.category, new.city, new.area, new.lat, new.lng, new.geocode_status, new.geocode_label,
          new.maps_url, new.hours_text, new.price_level, new.priority, new.notes, new.position, new.deleted_at, new.source)
         is distinct from
         (old.name, old.category, old.city, old.area, old.lat, old.lng, old.geocode_status, old.geocode_label,
          old.maps_url, old.hours_text, old.price_level, old.priority, old.notes, old.position, old.deleted_at, old.source) then
    raise exception 'viewers can only mark visits and rate' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger places_guard before update on public.places
  for each row execute function public.places_guard();

create or replace function public.places_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.in_bulk_write() then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.trip_id, 'place.created', 'place', new.id, jsonb_build_object('title', new.name));
  elsif new.status = 'visited' and old.status <> 'visited' then
    perform public.log_activity(new.trip_id, 'place.visited', 'place', new.id, jsonb_build_object('title', new.name));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.trip_id, 'place.deleted', 'place', new.id, jsonb_build_object('title', new.name));
  end if;
  return null;
end;
$$;

create trigger places_activity after insert or update on public.places
  for each row execute function public.places_activity();

alter table public.places enable row level security;

create policy "places: members read" on public.places for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "places: editors insert" on public.places for insert to authenticated
  with check (public.can_edit_trip(trip_id));
create policy "places: members update (viewers limited by guard)" on public.places for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

-- ---------------------------------------------------------------------------
-- Geocoding cache. Public map data only (a place name/city and its point),
-- shared across trips so the same lookup never hits the provider twice
-- (Nominatim policy: cache results).
-- ---------------------------------------------------------------------------
create table public.geocode_cache (
  query_key  text primary key check (char_length(query_key) <= 300),
  results    jsonb not null check (jsonb_typeof(results) = 'array'), -- [{lat,lng,label,kind}]
  provider   text not null,
  created_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;

create policy "geocode_cache: signed-in read" on public.geocode_cache for select to authenticated using (true);
create policy "geocode_cache: signed-in write" on public.geocode_cache for insert to authenticated with check (true);
