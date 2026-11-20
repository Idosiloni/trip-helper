-- Fix + repair: the app once wrote one profile range for a city that appears twice
-- in a trip ("Tokyo 28.11–11.12"), and fill_day_cities then put that city on every
-- day in between that had no city of its own.
--
-- 1. fill_day_cities picks the narrowest matching range (a short stay wins over a
--    long one), so overlapping ranges can't swallow the stays inside them.
-- 2. Repair: a day whose city disagrees with where its own stops are (at least two
--    stops with a place in the same other city, and most of the day's located stops)
--    gets that city back. That's what the plan showed before the bad fill.

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
               order by (c->>'to')::date - (c->>'from')::date
               limit 1) as city
        from public.trip_days d2
       where d2.trip_id = p_trip_id and d2.city is null
    ) sub
   where d.id = sub.id and sub.city is not null;
$$;

revoke execute on function public.fill_day_cities(uuid) from public, anon, authenticated;

-- The repair, as a function so it can be checked; run once here.
create or replace function public.repair_day_cities_from_stops()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare fixed int;
begin
with stop_cities as (
  select s.day_id, p.city, count(*) as n
    from public.stops s
    join public.places p on p.id = s.place_id and p.trip_id = s.trip_id
   where s.deleted_at is null and s.day_id is not null and p.deleted_at is null and p.city is not null and p.city <> ''
   group by s.day_id, p.city
), ranked as (
  select day_id, city, n,
         sum(n) over (partition by day_id) as total,
         row_number() over (partition by day_id order by n desc, city) as rk
    from stop_cities
)
update public.trip_days d
   set city = r.city
  from ranked r
 where r.day_id = d.id
   and r.rk = 1
   and r.n >= 2
   and r.n * 2 > r.total
   and d.city is not null
   and d.city <> r.city;
  get diagnostics fixed = row_count;
  return fixed;
end;
$$;

revoke execute on function public.repair_day_cities_from_stops() from public, anon, authenticated;

select public.repair_day_cities_from_stops();
