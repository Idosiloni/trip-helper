-- Design direction D: default colors move to the new printed-ink palette.
alter table public.profiles alter column avatar_color set default '#B8322A';
alter table public.trips alter column theme_color set default '#B8322A';

create or replace function public.create_trip(
  p_name text,
  p_theme_color text default '#B8322A',
  p_start_date date default null,
  p_end_date date default null
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  t public.trips;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.trips (name, theme_color, start_date, end_date, created_by)
  values (p_name, p_theme_color, p_start_date, p_end_date, uid)
  returning * into t;

  insert into public.trip_members (trip_id, user_id, role)
  values (t.id, uid, 'owner');

  return t;
end;
$$;
