-- Phase 3a: purchases & gifts (SPEC 6.4) and notes / info cards (SPEC 6.8).

create type public.note_kind as enum ('phrase', 'tip', 'emergency', 'money', 'etiquette', 'general');

create table public.purchases (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  for_whom    text check (char_length(for_whom) <= 60),
  budget      text check (char_length(budget) <= 40),            -- free text: "עד 20 ש״ח", "¥1500"
  place_id    uuid,
  where_text  text check (char_length(where_text) <= 120),        -- "Don Quijote" when it isn't a saved place
  link        text check (link is null or link ~* '^https?://\S+$'),
  notes       text check (char_length(notes) <= 2000),
  bought      boolean not null default false,
  bought_by   uuid references public.profiles (id) on delete set null,
  bought_at   timestamptz,
  source      public.item_source not null default 'manual',
  ai_import_id uuid references public.ai_imports (id) on delete set null,
  position    text collate "C" not null,
  deleted_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (place_id, trip_id) references public.places (id, trip_id) on delete set null (place_id)
);

create table public.trip_notes (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  kind         public.note_kind not null default 'general',
  title        text not null check (char_length(title) between 1 and 120),
  body         text check (char_length(body) <= 4000),
  source       public.item_source not null default 'manual',
  ai_import_id uuid references public.ai_imports (id) on delete set null,
  position     text collate "C" not null,
  deleted_at   timestamptz,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index purchases_trip_idx on public.purchases (trip_id);
create index trip_notes_trip_idx on public.trip_notes (trip_id);
create trigger purchases_set_updated_at before update on public.purchases for each row execute function public.set_updated_at();
create trigger trip_notes_set_updated_at before update on public.trip_notes for each row execute function public.set_updated_at();

-- Bought: who/when are set by the server. Viewers may only mark bought.
create or replace function public.purchases_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id <> old.trip_id then
    raise exception 'trip_id is immutable' using errcode = '42501';
  end if;
  if new.bought and not old.bought then
    new.bought_by := (select auth.uid());
    new.bought_at := now();
  elsif not new.bought and old.bought then
    new.bought_by := null;
    new.bought_at := null;
  else
    new.bought_by := old.bought_by;
    new.bought_at := old.bought_at;
  end if;
  if (select auth.uid()) is not null and public.my_trip_role(new.trip_id) = 'viewer'
     and (new.title, new.for_whom, new.budget, new.place_id, new.where_text, new.link, new.notes, new.position, new.deleted_at, new.source)
         is distinct from
         (old.title, old.for_whom, old.budget, old.place_id, old.where_text, old.link, old.notes, old.position, old.deleted_at, old.source) then
    raise exception 'viewers can only mark bought' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger purchases_guard before update on public.purchases
  for each row execute function public.purchases_guard();

create or replace function public.purchases_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.in_bulk_write() then return null; end if;
  if new.bought and not old.bought then
    perform public.log_activity(new.trip_id, 'purchase.bought', 'purchase', new.id, jsonb_build_object('title', new.title));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.trip_id, 'purchase.deleted', 'purchase', new.id, jsonb_build_object('title', new.title));
  end if;
  return null;
end;
$$;

create trigger purchases_activity after update on public.purchases
  for each row execute function public.purchases_activity();

create or replace function public.trip_notes_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.in_bulk_write() then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.trip_id, 'note.created', 'note', new.id, jsonb_build_object('title', new.title));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.trip_id, 'note.deleted', 'note', new.id, jsonb_build_object('title', new.title));
  end if;
  return null;
end;
$$;

create trigger trip_notes_activity after insert or update on public.trip_notes
  for each row execute function public.trip_notes_activity();

alter table public.purchases enable row level security;
alter table public.trip_notes enable row level security;

create policy "purchases: members read" on public.purchases for select to authenticated using (public.is_trip_member(trip_id));
create policy "purchases: editors insert" on public.purchases for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "purchases: members update (viewers limited by guard)" on public.purchases for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create policy "trip_notes: members read" on public.trip_notes for select to authenticated using (public.is_trip_member(trip_id));
create policy "trip_notes: editors insert" on public.trip_notes for insert to authenticated with check (public.can_edit_trip(trip_id));
create policy "trip_notes: editors update" on public.trip_notes for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

alter publication supabase_realtime add table public.purchases, public.trip_notes;

-- ---------------------------------------------------------------------------
-- commit_import v3: + purchases, notes; places may carry confirmed lat/lng
-- (KML from Google My Maps). Same transaction / bulk-write rules as before.
-- ---------------------------------------------------------------------------
create or replace function public.commit_import(
  p_trip_id uuid,
  p_kind text,
  p_items jsonb,
  p_raw_text text,
  p_prompt_id text default 'paste',
  p_prompt_version int default 0,
  p_source public.item_source default 'ai',
  p_source_label text default null,
  p_parsed jsonb default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  import_id uuid;
  n int := 0;
  m int := 0;
  place_items jsonb;
begin
  if uid is null or public.can_edit_trip(p_trip_id) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('tasks', 'packing', 'places', 'itinerary', 'purchases', 'notes') then
    raise exception 'unsupported kind %', p_kind using errcode = '22023';
  end if;
  if p_kind = 'itinerary' then
    if jsonb_typeof(p_items) <> 'object' then
      raise exception 'itinerary items must be an object' using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 300 then
    raise exception 'items must be a non-empty array of at most 300' using errcode = '22023';
  end if;

  insert into public.ai_imports (trip_id, prompt_id, prompt_version, kind, source_label, raw_text, parsed, created_by)
  values (p_trip_id, p_prompt_id, p_prompt_version, p_kind, p_source_label, p_raw_text, p_parsed, uid)
  returning id into import_id;

  perform set_config('app.bulk_write', 'on', true);

  if p_kind = 'tasks' then
    insert into public.tasks (trip_id, group_id, title, notes, link, due_at, due_all_day,
                              assignee_traveler_id, phase, source, ai_import_id, position, created_by)
    select p_trip_id, nullif(x->>'group_id', '')::uuid, x->>'title', nullif(x->>'notes', ''), nullif(x->>'link', ''),
           nullif(x->>'due_at', '')::timestamptz, coalesce((x->>'due_all_day')::boolean, true),
           nullif(x->>'assignee_traveler_id', '')::uuid, coalesce(nullif(x->>'phase', ''), 'before')::public.trip_phase,
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(p_items) as x;
    get diagnostics n = row_count;

  elsif p_kind = 'packing' then
    insert into public.packing_items (trip_id, title, category, qty, traveler_id, bag_id, notes, source, ai_import_id, position, created_by)
    select p_trip_id, x->>'title', coalesce(nullif(x->>'category', ''), 'other'), coalesce((x->>'qty')::int, 1),
           nullif(x->>'traveler_id', '')::uuid, nullif(x->>'bag_id', '')::uuid, nullif(x->>'notes', ''),
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(p_items) as x;
    get diagnostics n = row_count;

  elsif p_kind = 'purchases' then
    insert into public.purchases (trip_id, title, for_whom, budget, place_id, where_text, link, notes, source, ai_import_id, position, created_by)
    select p_trip_id, x->>'title', nullif(x->>'for_whom', ''), nullif(x->>'budget', ''), nullif(x->>'place_id', '')::uuid,
           nullif(x->>'where_text', ''), nullif(x->>'link', ''), nullif(x->>'notes', ''),
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(p_items) as x;
    get diagnostics n = row_count;

  elsif p_kind = 'notes' then
    insert into public.trip_notes (trip_id, kind, title, body, source, ai_import_id, position, created_by)
    select p_trip_id, coalesce(nullif(x->>'kind', ''), 'general')::public.note_kind, x->>'title', nullif(x->>'body', ''),
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(p_items) as x;
    get diagnostics n = row_count;

  else
    place_items := case when p_kind = 'places' then p_items else coalesce(p_items->'places', '[]'::jsonb) end;
    if jsonb_array_length(place_items) > 300 then
      raise exception 'too many places' using errcode = '22023';
    end if;
    insert into public.places (id, trip_id, name, category, city, area, notes, priority, hours_text, price_level,
                               lat, lng, geocode_status, geocode_label, source, ai_import_id, position, created_by)
    select coalesce(nullif(x->>'id', '')::uuid, gen_random_uuid()), p_trip_id, x->>'name',
           coalesce(nullif(x->>'category', ''), 'attraction')::public.place_category,
           nullif(x->>'city', ''), nullif(x->>'area', ''), nullif(x->>'notes', ''),
           coalesce(nullif(x->>'priority', ''), 'maybe')::public.place_priority,
           nullif(x->>'hours_text', ''), nullif(x->>'price_level', '')::smallint,
           nullif(x->>'lat', '')::double precision, nullif(x->>'lng', '')::double precision,
           case when nullif(x->>'lat', '') is not null and nullif(x->>'lng', '') is not null
                then 'confirmed' else 'pending' end::public.geocode_status,
           nullif(x->>'geocode_label', ''),
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(place_items) as x;
    get diagnostics n = row_count;

    if p_kind = 'itinerary' then
      if jsonb_array_length(coalesce(p_items->'stops', '[]'::jsonb)) > 300 then
        raise exception 'too many stops' using errcode = '22023';
      end if;
      update public.stops set deleted_at = now()
       where trip_id = p_trip_id and deleted_at is null
         and day_id in (select (v #>> '{}')::uuid from jsonb_array_elements(coalesce(p_items->'replace_day_ids', '[]'::jsonb)) v);
      insert into public.stops (trip_id, day_id, place_id, free_text, time_of_day, start_time, duration_min,
                                transport_note, notes, source, ai_import_id, position, created_by)
      select p_trip_id, nullif(x->>'day_id', '')::uuid, nullif(x->>'place_id', '')::uuid, nullif(x->>'free_text', ''),
             nullif(x->>'time_of_day', '')::public.time_of_day, nullif(x->>'start_time', '')::time,
             nullif(x->>'duration_min', '')::int, nullif(x->>'transport_note', ''), nullif(x->>'notes', ''),
             p_source, import_id, x->>'position', uid
      from jsonb_array_elements(coalesce(p_items->'stops', '[]'::jsonb)) as x;
      get diagnostics m = row_count;
    end if;
  end if;

  perform set_config('app.bulk_write', 'off', true);

  update public.ai_imports set accepted_count = n + m where id = import_id;
  perform public.log_activity(p_trip_id, 'import.committed', 'ai_import', import_id,
    jsonb_build_object('kind', p_kind, 'count', n + m, 'places', n, 'stops', m, 'via', p_source_label, 'source', p_source));
  return n + m;
end;
$$;

-- Notifications: name the new import kinds.
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
                when 'purchases' then 'פריטים לקנייה'
                when 'notes' then 'כרטיסיות מידע'
                else 'פריטים' end;
      perform public.enqueue_for_trip(new.trip_id, 'import',
        who || ': נוספו ' || n || ' ' || word,
        base || case new.payload->>'kind'
                  when 'tasks' then '/lists/tasks'
                  when 'packing' then '/lists/packing'
                  when 'places' then '/places'
                  when 'itinerary' then '/plan'
                  when 'purchases' then '/lists/purchases'
                  when 'notes' then '/lists/notes'
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

