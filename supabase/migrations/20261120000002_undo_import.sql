-- Undo the last paste (feedback 2026-11-20). Every row a paste creates carries its
-- ai_import_id, and the stops it replaced were soft-deleted in the same transaction,
-- so their deleted_at equals the import's created_at (now() is per transaction).
-- Undo = move the new rows to the trash and bring the replaced stops back.
alter table public.ai_imports add column undone_at timestamptz;

create or replace function public.undo_import(p_import_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  imp public.ai_imports;
  n int := 0;
  m int := 0;
begin
  select * into imp from public.ai_imports where id = p_import_id;
  if imp.id is null or (select auth.uid()) is null or public.can_edit_trip(imp.trip_id) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if imp.undone_at is not null then
    raise exception 'already undone' using errcode = '22023';
  end if;
  if imp.created_at < now() - interval '7 days' then
    raise exception 'too old to undo' using errcode = '22023';
  end if;

  perform set_config('app.bulk_write', 'on', true);

  update public.tasks         set deleted_at = now() where ai_import_id = imp.id and deleted_at is null;
  get diagnostics m = row_count; n := n + m;
  update public.packing_items set deleted_at = now() where ai_import_id = imp.id and deleted_at is null;
  get diagnostics m = row_count; n := n + m;
  update public.purchases     set deleted_at = now() where ai_import_id = imp.id and deleted_at is null;
  get diagnostics m = row_count; n := n + m;
  update public.trip_notes    set deleted_at = now() where ai_import_id = imp.id and deleted_at is null;
  get diagnostics m = row_count; n := n + m;
  update public.stops         set deleted_at = now() where ai_import_id = imp.id and deleted_at is null;
  get diagnostics m = row_count; n := n + m;
  -- Places the paste created, unless something else (a hand-added stop) now uses them.
  update public.places p set deleted_at = now()
   where p.ai_import_id = imp.id and p.deleted_at is null
     and not exists (select 1 from public.stops s where s.place_id = p.id and s.deleted_at is null);
  get diagnostics m = row_count; n := n + m;
  -- The days it replaced get their stops back.
  if imp.kind = 'itinerary' then
    update public.stops set deleted_at = null
     where trip_id = imp.trip_id and deleted_at = imp.created_at and ai_import_id is distinct from imp.id;
  end if;

  update public.ai_imports set undone_at = now() where id = imp.id;
  return n;
end;
$$;

revoke execute on function public.undo_import(uuid) from public, anon;
grant execute on function public.undo_import(uuid) to authenticated;
