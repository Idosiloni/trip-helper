-- Trips and membership. Every trip-scoped policy in later migrations goes
-- through public.my_trip_role(), which is SECURITY DEFINER so policies on
-- trip_members never recurse into themselves.

create table public.trips (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 60),
  theme_color    text not null default '#FF6B3D' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  start_date     date,
  end_date       date,
  phase_override public.trip_phase,
  -- Validated in the app with zod (src/lib/trip-profile.ts). Only the shape is checked here.
  profile        jsonb not null default '{}' check (jsonb_typeof(profile) = 'object'),
  archived_at    timestamptz,
  deleted_at     timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint trips_dates_ordered check (end_date is null or start_date is null or end_date >= start_date)
);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

create table public.trip_members (
  trip_id            uuid not null references public.trips (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  role               public.trip_role not null,
  notification_prefs jsonb not null default '{}' check (jsonb_typeof(notification_prefs) = 'object'),
  joined_at          timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

create or replace function public.my_trip_role(p_trip_id uuid)
returns public.trip_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.trip_members m
  where m.trip_id = p_trip_id
    and m.user_id = (select auth.uid());
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_trip_role(p_trip_id) is not null;
$$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.my_trip_role(p_trip_id) in ('owner', 'editor');
$$;

-- True when the given user shares at least one trip with the caller.
create or replace function public.shares_trip_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke execute on function public.my_trip_role(uuid), public.is_trip_member(uuid),
  public.can_edit_trip(uuid), public.shares_trip_with(uuid) from public, anon;
grant execute on function public.my_trip_role(uuid), public.is_trip_member(uuid),
  public.can_edit_trip(uuid), public.shares_trip_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

-- Only an owner may archive or delete a trip; nobody may rewrite created_by.
create or replace function public.trips_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- service role / maintenance
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  if (new.archived_at is distinct from old.archived_at or new.deleted_at is distinct from old.deleted_at)
     and public.my_trip_role(old.id) is distinct from 'owner' then
    raise exception 'only an owner can archive or delete a trip' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trips_guard
  before update on public.trips
  for each row execute function public.trips_guard();

-- Role changes need an owner, and a trip always keeps at least one owner.
create or replace function public.trip_members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_count int;
begin
  if (select auth.uid()) is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' then
    if new.trip_id <> old.trip_id or new.user_id <> old.user_id then
      raise exception 'membership keys are immutable' using errcode = '42501';
    end if;
    if new.role <> old.role and public.my_trip_role(old.trip_id) is distinct from 'owner' then
      raise exception 'only an owner can change roles' using errcode = '42501';
    end if;
  end if;

  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into owner_count
    from public.trip_members
    where trip_id = old.trip_id and role = 'owner';
    if owner_count <= 1 then
      raise exception 'a trip must keep at least one owner' using errcode = 'P0001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trip_members_guard
  before update or delete on public.trip_members
  for each row execute function public.trip_members_guard();

-- ---------------------------------------------------------------------------
-- RPC: create a trip and make the caller its owner in one transaction.
-- (A plain INSERT can't do this: RETURNING would be checked against the
-- member-only SELECT policy before the owner row exists.)
-- ---------------------------------------------------------------------------

create or replace function public.create_trip(
  p_name text,
  p_theme_color text default '#FF6B3D',
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

revoke execute on function public.create_trip(text, text, date, date) from public, anon;
grant execute on function public.create_trip(text, text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

create policy "trips: members read"
  on public.trips for select
  to authenticated
  using (public.is_trip_member(id));

-- No INSERT policy: trips are created through create_trip().
-- No DELETE policy: trips are soft-deleted (deleted_at), owner only (trips_guard).
create policy "trips: editors update"
  on public.trips for update
  to authenticated
  using (public.can_edit_trip(id))
  with check (public.can_edit_trip(id));

create policy "trip_members: members read"
  on public.trip_members for select
  to authenticated
  using (public.is_trip_member(trip_id));

-- No INSERT policy: members join through create_trip() or accept_invite() (phase 1).
create policy "trip_members: owner or self update"
  on public.trip_members for update
  to authenticated
  using (public.my_trip_role(trip_id) = 'owner' or user_id = (select auth.uid()))
  with check (public.my_trip_role(trip_id) = 'owner' or user_id = (select auth.uid()));

create policy "trip_members: owner removes, anyone leaves"
  on public.trip_members for delete
  to authenticated
  using (public.my_trip_role(trip_id) = 'owner' or user_id = (select auth.uid()));

create policy "profiles: read fellow members"
  on public.profiles for select
  to authenticated
  using (public.shares_trip_with(id));
