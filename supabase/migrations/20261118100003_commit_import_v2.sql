-- commit_import v2: adds 'places' and 'itinerary' (SPEC 7.3 for phase 2).
--
-- places:    p_items = [ {id?, name, category, city, area, notes, priority, hours_text, price_level, position}, ... ]
--            New places start with geocode_status 'pending' (the app then asks to confirm each pin).
-- itinerary: p_items = { "places": [...as above, with client ids...],
--                        "stops":  [ {day_id?, place_id?, free_text?, time_of_day?, start_time?,
--                                     duration_min?, transport_note?, notes?, position}, ... ],
--                        "replace_day_ids": [uuid, ...] }
--            replace_day_ids: days whose current stops are soft-deleted first
--            (accepting a reviewed day from prompt 7). All in one transaction.

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
  if p_kind not in ('tasks', 'packing', 'places', 'itinerary') then
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

  else
    place_items := case when p_kind = 'places' then p_items else coalesce(p_items->'places', '[]'::jsonb) end;
    if jsonb_array_length(place_items) > 300 then
      raise exception 'too many places' using errcode = '22023';
    end if;
    insert into public.places (id, trip_id, name, category, city, area, notes, priority, hours_text, price_level,
                               geocode_status, source, ai_import_id, position, created_by)
    select coalesce(nullif(x->>'id', '')::uuid, gen_random_uuid()), p_trip_id, x->>'name',
           coalesce(nullif(x->>'category', ''), 'attraction')::public.place_category,
           nullif(x->>'city', ''), nullif(x->>'area', ''), nullif(x->>'notes', ''),
           coalesce(nullif(x->>'priority', ''), 'maybe')::public.place_priority,
           nullif(x->>'hours_text', ''), nullif(x->>'price_level', '')::smallint,
           'pending', p_source, import_id, x->>'position', uid
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
