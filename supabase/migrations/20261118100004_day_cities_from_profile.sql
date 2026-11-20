-- Fix: a new trip is created first and its profile (with city dates) is saved
-- right after, so its days were generated before any cities existed.
-- Now a profile change also fills in cities for days that have none
-- (never overwriting a city someone set by hand).

create or replace function public.fill_day_cities(p_trip_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.trip_days d
     set city = sub.city
    from (
      select d2.id,
             (select c->>'name'
                from public.trips t,
                     jsonb_array_elements(coalesce(t.profile->'destinations', '[]'::jsonb)) dest,
                     jsonb_array_elements(coalesce(dest->'cities', '[]'::jsonb)) c
               where t.id = p_trip_id
                 and (c->>'from') ~ '^\d{4}-\d{2}-\d{2}$' and (c->>'to') ~ '^\d{4}-\d{2}-\d{2}$'
                 and d2.date between (c->>'from')::date and (c->>'to')::date
               limit 1) as city
        from public.trip_days d2
       where d2.trip_id = p_trip_id and d2.city is null
    ) sub
   where d.id = sub.id and sub.city is not null;
$$;

revoke execute on function public.fill_day_cities(uuid) from public, anon, authenticated;

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
  if tg_op = 'INSERT' or new.profile is distinct from old.profile then
    perform public.fill_day_cities(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists trips_sync_days on public.trips;
create trigger trips_sync_days after insert or update of start_date, end_date, profile on public.trips
  for each row execute function public.trips_sync_days();

-- Backfill trips created before this fix.
do $$
declare r record;
begin
  for r in select id from public.trips loop
    perform public.fill_day_cities(r.id);
  end loop;
end;
$$;
