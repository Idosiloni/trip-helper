-- Tasks (SPEC 6.2). Assigned to a traveler; a viewer may only check off
-- tasks assigned to their own traveler (PLAN decision 5).

create table public.task_groups (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  position   text collate "C" not null,
  deleted_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, trip_id)
);

create table public.tasks (
  id                   uuid primary key default gen_random_uuid(),
  trip_id              uuid not null references public.trips (id) on delete cascade,
  group_id             uuid,
  title                text not null check (char_length(title) between 1 and 200),
  notes                text check (char_length(notes) <= 4000),
  link                 text check (link is null or link ~* '^https?://\S+$'),
  due_at               timestamptz,
  due_all_day          boolean not null default true,
  remind_at            timestamptz,               -- stored now, sent in phase 2
  assignee_traveler_id uuid,
  phase                public.trip_phase not null default 'before',
  done                 boolean not null default false,
  done_by              uuid references public.profiles (id) on delete set null,
  done_at              timestamptz,
  source               public.item_source not null default 'manual',
  ai_import_id         uuid references public.ai_imports (id) on delete set null,
  position             text collate "C" not null,
  deleted_at           timestamptz,
  created_by           uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (group_id, trip_id) references public.task_groups (id, trip_id) on delete set null (group_id),
  foreign key (assignee_traveler_id, trip_id) references public.travelers (id, trip_id) on delete set null (assignee_traveler_id)
);

create index tasks_trip_idx on public.tasks (trip_id);
create index task_groups_trip_idx on public.task_groups (trip_id);

create trigger task_groups_set_updated_at before update on public.task_groups
  for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- done_by / done_at follow `done`; viewers may change nothing but `done`.
create or replace function public.tasks_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.trip_id <> old.trip_id then
      raise exception 'trip_id is immutable' using errcode = '42501';
    end if;
    if (select auth.uid()) is not null and public.my_trip_role(new.trip_id) = 'viewer'
       and (new.title, new.notes, new.link, new.due_at, new.due_all_day, new.remind_at,
            new.assignee_traveler_id, new.phase, new.group_id, new.position, new.deleted_at, new.source)
           is distinct from
           (old.title, old.notes, old.link, old.due_at, old.due_all_day, old.remind_at,
            old.assignee_traveler_id, old.phase, old.group_id, old.position, old.deleted_at, old.source) then
      raise exception 'viewers can only check off their own tasks' using errcode = '42501';
    end if;
    if new.done is distinct from old.done then
      new.done_by := case when new.done then (select auth.uid()) end;
      new.done_at := case when new.done then now() end;
    end if;
  elsif new.done then
    new.done_by := (select auth.uid());
    new.done_at := now();
  end if;
  return new;
end;
$$;

create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.tasks_guard();

create or replace function public.tasks_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.in_bulk_write() then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity(new.trip_id, 'task.created', 'task', new.id, jsonb_build_object('title', new.title));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.trip_id, 'task.deleted', 'task', new.id, jsonb_build_object('title', new.title));
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.log_activity(new.trip_id, 'task.restored', 'task', new.id, jsonb_build_object('title', new.title));
  elsif new.done and not old.done then
    perform public.log_activity(new.trip_id, 'task.done', 'task', new.id, jsonb_build_object('title', new.title));
  end if;
  return null;
end;
$$;

create trigger tasks_activity after insert or update on public.tasks
  for each row execute function public.tasks_activity();

alter table public.task_groups enable row level security;
alter table public.tasks enable row level security;

create policy "task_groups: members read" on public.task_groups for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "task_groups: editors insert" on public.task_groups for insert to authenticated
  with check (public.can_edit_trip(trip_id));
create policy "task_groups: editors update" on public.task_groups for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy "tasks: members read" on public.tasks for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "tasks: editors insert" on public.tasks for insert to authenticated
  with check (public.can_edit_trip(trip_id));
create policy "tasks: editors update, viewers their own" on public.tasks for update to authenticated
  using (public.can_edit_trip(trip_id)
         or (public.my_trip_role(trip_id) = 'viewer' and public.is_my_traveler(assignee_traveler_id)))
  with check (public.can_edit_trip(trip_id)
         or (public.my_trip_role(trip_id) = 'viewer' and public.is_my_traveler(assignee_traveler_id)));
