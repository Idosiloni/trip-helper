-- trips.profile is one jsonb column. To keep "no overwrites" (SPEC §11) when
-- two people edit different parts of it, clients send only the top-level keys
-- they changed and this merges them: profile = profile || patch.

create or replace function public.patch_trip_profile(p_trip_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security invoker -- RLS on trips applies (editors only)
set search_path = ''
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;
  update public.trips
     set profile = profile || p_patch
   where id = p_trip_id
  returning profile into result;
  if result is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return result;
end;
$$;

revoke execute on function public.patch_trip_profile(uuid, jsonb) from public, anon;
grant execute on function public.patch_trip_profile(uuid, jsonb) to authenticated;
