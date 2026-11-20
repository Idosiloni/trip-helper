-- Second repair pass: a day whose city appears in none of its own stops' places
-- (a day trip split between two cities, so no single city had a majority) loses that
-- city, so the app shows where its stops are again; the profile then fills it from
-- the narrowest matching range, as before the bad fill.

create or replace function public.repair_day_cities_unmatched()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  fixed int;
  t uuid;
begin
  with located as (
    select s.day_id, p.city
      from public.stops s
      join public.places p on p.id = s.place_id and p.trip_id = s.trip_id
     where s.deleted_at is null and s.day_id is not null and p.deleted_at is null and p.city is not null and p.city <> ''
  ), cleared as (
    update public.trip_days d
       set city = null
     where d.city is not null
       and exists (select 1 from located l where l.day_id = d.id)
       and not exists (select 1 from located l where l.day_id = d.id and l.city = d.city)
    returning d.trip_id
  )
  select count(*) into fixed from cleared;
  for t in select distinct trip_id from public.trip_days loop
    perform public.fill_day_cities(t);
  end loop;
  return fixed;
end;
$$;

revoke execute on function public.repair_day_cities_unmatched() from public, anon, authenticated;

select public.repair_day_cities_unmatched();
