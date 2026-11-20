-- Fix: Supabase rejects DELETE without WHERE (pg-safeupdate), which PGlite allows.

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
  delete from pg_temp._dup_map where true;

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
