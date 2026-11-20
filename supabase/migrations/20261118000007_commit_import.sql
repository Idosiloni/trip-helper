-- commit_import(): saves one confirmed import (from a chat answer or a pasted
-- list) in a single transaction, and writes ONE feed row for it.
-- The client has already validated items with zod, resolved destinations
-- (group / traveler / bag) and computed positions; the table constraints and
-- composite foreign keys re-check everything here.

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
  n int;
begin
  if uid is null or public.can_edit_trip(p_trip_id) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('tasks', 'packing') then
    raise exception 'unsupported kind %', p_kind using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 300 then
    raise exception 'items must be a non-empty array of at most 300' using errcode = '22023';
  end if;

  insert into public.ai_imports (trip_id, prompt_id, prompt_version, kind, source_label, raw_text, parsed, created_by)
  values (p_trip_id, p_prompt_id, p_prompt_version, p_kind, p_source_label, p_raw_text, p_parsed, uid)
  returning id into import_id;

  perform set_config('app.bulk_write', 'on', true);

  if p_kind = 'tasks' then
    insert into public.tasks (trip_id, group_id, title, notes, link, due_at, due_all_day,
                              assignee_traveler_id, phase, source, ai_import_id, position, created_by)
    select p_trip_id,
           nullif(x->>'group_id', '')::uuid,
           x->>'title',
           nullif(x->>'notes', ''),
           nullif(x->>'link', ''),
           nullif(x->>'due_at', '')::timestamptz,
           coalesce((x->>'due_all_day')::boolean, true),
           nullif(x->>'assignee_traveler_id', '')::uuid,
           coalesce(nullif(x->>'phase', ''), 'before')::public.trip_phase,
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(p_items) as x;
  else
    insert into public.packing_items (trip_id, title, category, qty, traveler_id, bag_id, notes,
                                      source, ai_import_id, position, created_by)
    select p_trip_id,
           x->>'title',
           coalesce(nullif(x->>'category', ''), 'other'),
           coalesce((x->>'qty')::int, 1),
           nullif(x->>'traveler_id', '')::uuid,
           nullif(x->>'bag_id', '')::uuid,
           nullif(x->>'notes', ''),
           p_source, import_id, x->>'position', uid
    from jsonb_array_elements(p_items) as x;
  end if;

  get diagnostics n = row_count;
  perform set_config('app.bulk_write', 'off', true);

  update public.ai_imports set accepted_count = n where id = import_id;
  perform public.log_activity(p_trip_id, 'import.committed', 'ai_import', import_id,
    jsonb_build_object('kind', p_kind, 'count', n, 'via', p_source_label, 'source', p_source));
  return n;
end;
$$;

revoke execute on function public.commit_import(uuid, text, jsonb, text, text, int, public.item_source, text, jsonb) from public, anon;
grant execute on function public.commit_import(uuid, text, jsonb, text, text, int, public.item_source, text, jsonb) to authenticated;
