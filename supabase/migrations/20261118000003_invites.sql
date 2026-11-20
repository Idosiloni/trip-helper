-- Invite links. A non-member can't read invites, so previewing and accepting
-- go through SECURITY DEFINER RPCs.

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  -- 64 hex chars (two v4 UUIDs, ~244 random bits); unguessable and URL-safe.
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role       public.trip_role not null default 'editor' check (role <> 'owner'),
  expires_at timestamptz not null default now() + interval '14 days',
  max_uses   int check (max_uses is null or max_uses > 0),
  use_count  int not null default 0,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index invites_trip_idx on public.invites (trip_id);

alter table public.invites enable row level security;

create policy "invites: editors read"
  on public.invites for select to authenticated
  using (public.can_edit_trip(trip_id));

create policy "invites: editors create"
  on public.invites for insert to authenticated
  with check (public.can_edit_trip(trip_id) and use_count = 0 and revoked_at is null);

-- Updating is only for revoking (revoked_at); use_count changes only in accept_invite().
create policy "invites: editors revoke"
  on public.invites for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));

create or replace function public.invites_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  -- accept_invite() bumps use_count; it sets this transaction-local flag first.
  if coalesce(current_setting('app.accepting_invite', true), '') = 'on'
     and (new.trip_id, new.token, new.role, new.created_by) is not distinct from (old.trip_id, old.token, old.role, old.created_by) then
    return new;
  end if;
  if new.trip_id <> old.trip_id or new.token <> old.token or new.use_count <> old.use_count
     or new.role <> old.role or new.created_by is distinct from old.created_by then
    raise exception 'only revoked_at and expires_at can change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger invites_guard
  before update on public.invites
  for each row execute function public.invites_guard();

-- ---------------------------------------------------------------------------
-- invite_preview(token): what the join screen shows before sign-in.
-- Deliberately minimal: no member list, no trip profile.
-- ---------------------------------------------------------------------------
create or replace function public.invite_preview(p_token text)
returns table (
  status       text,      -- 'ok' | 'not_found' | 'expired' | 'revoked' | 'used_up'
  trip_name    text,
  theme_color  text,
  start_date   date,
  end_date     date,
  inviter_name text,
  role         public.trip_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  i public.invites;
  t public.trips;
begin
  select * into i from public.invites where token = p_token;
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::date, null::date, null::text, null::public.trip_role;
    return;
  end if;
  select * into t from public.trips where id = i.trip_id and deleted_at is null;
  if not found then
    return query select 'not_found'::text, null::text, null::text, null::date, null::date, null::text, null::public.trip_role;
    return;
  end if;
  return query
  select
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      when i.max_uses is not null and i.use_count >= i.max_uses then 'used_up'
      else 'ok'
    end,
    t.name, t.theme_color, t.start_date, t.end_date,
    (select p.display_name from public.profiles p where p.id = i.created_by),
    i.role;
end;
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- invite_travelers(token): the trip's travelers, so the join screen can ask
-- "which one are you?". Only while the invite is valid; labels and order only.
-- ---------------------------------------------------------------------------
create or replace function public.invite_travelers(p_token text)
returns table (id uuid, label text, "position" text, linked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.label, t.position::text, t.linked_user_id is not null
  from public.invites i
  join public.travelers t on t.trip_id = i.trip_id and t.deleted_at is null
  where i.token = p_token
    and i.revoked_at is null
    and i.expires_at >= now()
    and (i.max_uses is null or i.use_count < i.max_uses)
  order by t.position;
$$;

revoke execute on function public.invite_travelers(text) from public, anon;
grant execute on function public.invite_travelers(text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invite(token, traveler_id?, new_position?): join the trip.
-- Either links the caller to an existing unlinked traveler, or adds a new
-- traveler with their display name at p_new_position (a fractional-indexing
-- key the client computed after the last traveler). Joining twice is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invite(
  p_token text,
  p_traveler_id uuid default null,
  p_new_position text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  i public.invites;
  my_name text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into i from public.invites where token = p_token for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.trip_members where trip_id = i.trip_id and user_id = uid) then
    return i.trip_id;
  end if;

  if i.revoked_at is not null or i.expires_at < now()
     or (i.max_uses is not null and i.use_count >= i.max_uses) then
    raise exception 'invite is no longer valid' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.trips where id = i.trip_id and deleted_at is null) then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  insert into public.trip_members (trip_id, user_id, role) values (i.trip_id, uid, i.role);
  perform set_config('app.accepting_invite', 'on', true);
  update public.invites set use_count = use_count + 1 where id = i.id;
  perform set_config('app.accepting_invite', 'off', true);

  if p_traveler_id is not null then
    update public.travelers
       set linked_user_id = uid
     where id = p_traveler_id and trip_id = i.trip_id
       and linked_user_id is null and deleted_at is null;
  end if;

  if p_new_position is not null
     and not exists (select 1 from public.travelers where trip_id = i.trip_id and linked_user_id = uid and deleted_at is null) then
    select coalesce(nullif(display_name, ''), 'מטייל') into my_name from public.profiles where id = uid;
    insert into public.travelers (trip_id, label, linked_user_id, position, created_by)
    values (i.trip_id, left(my_name, 40), uid, p_new_position, uid);
  end if;

  perform public.log_activity(i.trip_id, 'member.joined', 'profile', uid, jsonb_build_object('role', i.role));
  return i.trip_id;
end;
$$;

revoke execute on function public.accept_invite(text, uuid, text) from public, anon;
grant execute on function public.accept_invite(text, uuid, text) to authenticated;
