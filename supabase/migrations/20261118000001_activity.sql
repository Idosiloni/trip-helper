-- Phase 1: shared enums and the activity feed.
-- Activity rows are written only by SECURITY DEFINER triggers and RPCs.

create type public.age_group as enum ('infant', 'child', 'teen', 'adult', 'senior');
create type public.item_source as enum ('manual', 'ai', 'template', 'paste');
create type public.packing_state as enum ('need', 'packed', 'missing');
create type public.bag_kind as enum ('suitcase', 'carry_on', 'backpack', 'other');

create table public.activity (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  type        text not null,   -- 'task.created' | 'task.done' | 'task.deleted' | 'import.committed' | 'member.joined' | 'bag.packed' ...
  entity_type text,
  entity_id   uuid,
  payload     jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  created_at  timestamptz not null default now()
);

create index activity_trip_created_idx on public.activity (trip_id, created_at desc);

alter table public.activity enable row level security;

create policy "activity: members read"
  on public.activity for select
  to authenticated
  using (public.is_trip_member(trip_id));

-- True while commit_import() runs, so per-row triggers don't flood the feed.
create or replace function public.in_bulk_write()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.bulk_write', true), '') = 'on';
$$;

create or replace function public.log_activity(
  p_trip_id uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity (trip_id, actor_id, type, entity_type, entity_id, payload)
  values (p_trip_id, (select auth.uid()), p_type, p_entity_type, p_entity_id, coalesce(p_payload, '{}'));
$$;

revoke execute on function public.log_activity(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- Fix: can_edit_trip() returned NULL (not false) for non-members, so a plpgsql
-- guard written as `if not can_edit_trip(...)` let them through. Always boolean now.
create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_trip_role(p_trip_id) in ('owner', 'editor'), false);
$$;
