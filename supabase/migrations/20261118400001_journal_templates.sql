-- Phase 4a: journal (SPEC 6.9, photos come later), templates and trip duplication.

-- ---------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  day_id       uuid references public.trip_days (id) on delete set null,
  place_id     uuid,
  body         text not null check (char_length(body) between 1 and 8000),
  rating       smallint check (rating between 1 and 5),
  source       public.item_source not null default 'manual',
  position     text collate "C" not null,
  deleted_at   timestamptz,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete set null (place_id)
);

create index journal_entries_trip_idx on public.journal_entries (trip_id);
create trigger journal_entries_set_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- Everyone in the trip may write memories (viewers too, e.g. the kids).
-- Editors may edit any entry; others only their own. The author never changes.
create or replace function public.journal_entries_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id <> old.trip_id then
    raise exception 'trip_id is immutable' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  if (select auth.uid()) is not null and public.can_edit_trip(new.trip_id) is not true
     and old.created_by is distinct from (select auth.uid()) then
    raise exception 'only the author can edit this entry' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger journal_entries_guard before update on public.journal_entries
  for each row execute function public.journal_entries_guard();

create or replace function public.journal_entries_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.in_bulk_write() then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.trip_id, 'journal.created', 'journal', new.id, jsonb_build_object('title', left(new.body, 60)));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.trip_id, 'journal.deleted', 'journal', new.id, jsonb_build_object('title', left(new.body, 60)));
  end if;
  return null;
end;
$$;

create trigger journal_entries_activity after insert or update on public.journal_entries
  for each row execute function public.journal_entries_activity();

alter table public.journal_entries enable row level security;

create policy "journal: members read" on public.journal_entries for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "journal: members insert as themselves" on public.journal_entries for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = (select auth.uid()));
create policy "journal: members update (authors / editors by guard)" on public.journal_entries for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

alter publication supabase_realtime add table public.journal_entries;

-- ---------------------------------------------------------------------------
-- Templates (built-in ones live in the app's code; these are "mine")
-- payload: { task_groups:[{key,title,position}], tasks:[{title,notes,link,phase,group,position}],
--            packing:[{title,category,qty,notes,position}], notes:[{kind,title,body,position}] }
-- ---------------------------------------------------------------------------
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name       text not null check (char_length(name) between 1 and 60),
  payload    jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 500000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_owner_idx on public.templates (owner_id);
create trigger templates_set_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.templates enable row level security;

create policy "templates: owner reads" on public.templates for select to authenticated using (owner_id = (select auth.uid()));
create policy "templates: owner inserts" on public.templates for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "templates: owner updates" on public.templates for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "templates: owner deletes" on public.templates for delete to authenticated using (owner_id = (select auth.uid()));

-- What a trip's lists look like as a starting point (live rows, state reset).
create or replace function public.trip_template_payload(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'task_groups', coalesce((select jsonb_agg(jsonb_build_object('key', g.id, 'title', g.title, 'position', g.position) order by g.position)
                               from public.task_groups g where g.trip_id = p_trip_id and g.deleted_at is null), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'notes', t.notes, 'link', t.link, 'phase', t.phase,
                                                           'group', t.group_id, 'position', t.position) order by t.position)
                         from public.tasks t where t.trip_id = p_trip_id and t.deleted_at is null), '[]'::jsonb),
    'packing', coalesce((select jsonb_agg(jsonb_build_object('title', p.title, 'category', p.category, 'qty', p.qty,
                                                             'notes', p.notes, 'position', p.position) order by p.position)
                           from public.packing_items p where p.trip_id = p_trip_id and p.deleted_at is null), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'title', n.title, 'body', n.body, 'position', n.position) order by n.position)
                         from public.trip_notes n where n.trip_id = p_trip_id and n.deleted_at is null), '[]'::jsonb)
  );
$$;

revoke execute on function public.trip_template_payload(uuid) from public, anon, authenticated;

-- Fills a trip's lists from a template payload. Internal: callers check access.
create or replace function public.apply_template_payload(p_trip_id uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  groups jsonb := coalesce(p_payload->'task_groups', '[]'::jsonb);
  map jsonb := '{}'::jsonb;
  g jsonb;
  new_id uuid;
begin
  if jsonb_typeof(groups) <> 'array' or jsonb_array_length(groups) > 50
     or jsonb_typeof(coalesce(p_payload->'tasks', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payload->'tasks', '[]'::jsonb)) > 500
     or jsonb_typeof(coalesce(p_payload->'packing', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payload->'packing', '[]'::jsonb)) > 500
     or jsonb_typeof(coalesce(p_payload->'notes', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_payload->'notes', '[]'::jsonb)) > 200 then
    raise exception 'template too large or malformed' using errcode = '22023';
  end if;

  for g in select * from jsonb_array_elements(groups) loop
    insert into public.task_groups (trip_id, title, position, created_by)
    values (p_trip_id, g->>'title', g->>'position', uid)
    returning id into new_id;
    map := map || jsonb_build_object(g->>'key', new_id);
  end loop;

  insert into public.tasks (trip_id, group_id, title, notes, link, phase, source, position, created_by)
  select p_trip_id, nullif(map->>(x->>'group'), '')::uuid, x->>'title', nullif(x->>'notes', ''), nullif(x->>'link', ''),
         coalesce(nullif(x->>'phase', ''), 'before')::public.trip_phase, 'template', x->>'position', uid
  from jsonb_array_elements(coalesce(p_payload->'tasks', '[]'::jsonb)) x;

  insert into public.packing_items (trip_id, title, category, qty, notes, source, position, created_by)
  select p_trip_id, x->>'title', coalesce(nullif(x->>'category', ''), 'other'), coalesce((x->>'qty')::int, 1),
         nullif(x->>'notes', ''), 'template', x->>'position', uid
  from jsonb_array_elements(coalesce(p_payload->'packing', '[]'::jsonb)) x;

  insert into public.trip_notes (trip_id, kind, title, body, source, position, created_by)
  select p_trip_id, coalesce(nullif(x->>'kind', ''), 'general')::public.note_kind, x->>'title', nullif(x->>'body', ''),
         'template', x->>'position', uid
  from jsonb_array_elements(coalesce(p_payload->'notes', '[]'::jsonb)) x;
end;
$$;

revoke execute on function public.apply_template_payload(uuid, jsonb) from public, anon, authenticated;

-- New trip, filled from a template (a built-in one sent by the app, or one of mine).
create or replace function public.create_trip_from_template(
  p_name text,
  p_theme_color text,
  p_start_date date,
  p_end_date date,
  p_payload jsonb
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.trips;
begin
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 500000 then
    raise exception 'bad template' using errcode = '22023';
  end if;
  t := public.create_trip(p_name, p_theme_color, p_start_date, p_end_date);
  perform set_config('app.bulk_write', 'on', true);
  perform public.apply_template_payload(t.id, p_payload);
  perform set_config('app.bulk_write', 'off', true);
  perform public.log_activity(t.id, 'trip.from_template', 'trip', t.id, '{}'::jsonb);
  return t;
end;
$$;

revoke execute on function public.create_trip_from_template(text, text, date, date, jsonb) from public, anon;
grant execute on function public.create_trip_from_template(text, text, date, date, jsonb) to authenticated;

create or replace function public.save_trip_as_template(p_trip_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null or public.is_trip_member(p_trip_id) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.templates (owner_id, name, payload)
  values (uid, p_name, public.trip_template_payload(p_trip_id))
  returning templates.id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.save_trip_as_template(uuid, text) from public, anon;
grant execute on function public.save_trip_as_template(uuid, text) to authenticated;

-- A copy of a trip as a fresh start: profile (without city dates), travelers,
-- bags, lists and places, all reset. Never bookings, the plan, the journal,
-- purchases or confirmation codes. Only the caller becomes a member.
create or replace function public.duplicate_trip(p_trip_id uuid, p_name text, p_start_date date default null, p_end_date date default null)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  src public.trips;
  t public.trips;
  new_profile jsonb;
begin
  if uid is null or public.is_trip_member(p_trip_id) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into src from public.trips where id = p_trip_id and deleted_at is null;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  t := public.create_trip(p_name, src.theme_color, p_start_date, p_end_date);

  -- City dates belong to the old dates: keep the cities, drop from/to.
  new_profile := src.profile;
  if jsonb_typeof(new_profile->'destinations') = 'array' then
    new_profile := jsonb_set(new_profile, '{destinations}', (
      select coalesce(jsonb_agg(
               case when jsonb_typeof(d->'cities') = 'array'
                    then jsonb_set(d, '{cities}', (select coalesce(jsonb_agg(c - 'from' - 'to'), '[]'::jsonb) from jsonb_array_elements(d->'cities') c))
                    else d end), '[]'::jsonb)
        from jsonb_array_elements(new_profile->'destinations') d));
  end if;

  perform set_config('app.bulk_write', 'on', true);
  update public.trips set profile = new_profile where id = t.id returning * into t;

  create temp table if not exists _dup_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from pg_temp._dup_map;

  insert into pg_temp._dup_map (old_id, new_id)
  select id, gen_random_uuid() from public.travelers where trip_id = p_trip_id and deleted_at is null;
  insert into public.travelers (id, trip_id, label, age_group, birth_year, interests, linked_user_id, position, created_by)
  select m.new_id, t.id, x.label, x.age_group, x.birth_year, x.interests,
         case when x.linked_user_id = uid then uid end, x.position, uid
  from public.travelers x join pg_temp._dup_map m on m.old_id = x.id;

  insert into pg_temp._dup_map (old_id, new_id)
  select id, gen_random_uuid() from public.bags where trip_id = p_trip_id and deleted_at is null;
  insert into public.bags (id, trip_id, label, kind, owner_traveler_id, position, created_by)
  select m.new_id, t.id, b.label, b.kind, (select new_id from pg_temp._dup_map where old_id = b.owner_traveler_id), b.position, uid
  from public.bags b join pg_temp._dup_map m on m.old_id = b.id;

  perform public.apply_template_payload(t.id, public.trip_template_payload(p_trip_id) - 'packing');

  insert into public.packing_items (trip_id, title, category, qty, traveler_id, bag_id, notes, source, position, created_by)
  select t.id, p.title, p.category, p.qty,
         (select new_id from pg_temp._dup_map where old_id = p.traveler_id),
         (select new_id from pg_temp._dup_map where old_id = p.bag_id),
         p.notes, 'template', p.position, uid
  from public.packing_items p where p.trip_id = p_trip_id and p.deleted_at is null;

  insert into public.places (trip_id, name, category, city, area, lat, lng, geocode_status, geocode_label, maps_url,
                             hours_text, price_level, priority, notes, source, position, created_by)
  select t.id, p.name, p.category, p.city, p.area, p.lat, p.lng, p.geocode_status, p.geocode_label, p.maps_url,
         p.hours_text, p.price_level, p.priority, p.notes, 'template', p.position, uid
  from public.places p where p.trip_id = p_trip_id and p.deleted_at is null;

  perform set_config('app.bulk_write', 'off', true);
  perform public.log_activity(t.id, 'trip.duplicated', 'trip', t.id, jsonb_build_object('from', src.name));
  return t;
end;
$$;

revoke execute on function public.duplicate_trip(uuid, text, date, date) from public, anon;
grant execute on function public.duplicate_trip(uuid, text, date, date) to authenticated;
