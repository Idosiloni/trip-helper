-- Travelers: the people on the trip, with or without an account.
-- Tasks and packing items are assigned to travelers (PLAN decision 2).

create table public.travelers (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  label          text not null check (char_length(label) between 1 and 40),
  age_group      public.age_group not null default 'adult',
  birth_year     int check (birth_year between 1900 and 2100),
  interests      text[] not null default '{}',
  linked_user_id uuid references public.profiles (id) on delete set null,
  position       text collate "C" not null,
  deleted_at     timestamptz,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, trip_id)
);

create unique index travelers_one_per_user
  on public.travelers (trip_id, linked_user_id)
  where linked_user_id is not null and deleted_at is null;
create index travelers_trip_idx on public.travelers (trip_id);

create trigger travelers_set_updated_at
  before update on public.travelers
  for each row execute function public.set_updated_at();

-- Is this traveler the caller? Used for "viewers may check off their own items".
create or replace function public.is_my_traveler(p_traveler_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.travelers t
    where t.id = p_traveler_id
      and t.linked_user_id = (select auth.uid())
      and t.deleted_at is null
  );
$$;

revoke execute on function public.is_my_traveler(uuid) from public, anon;
grant execute on function public.is_my_traveler(uuid) to authenticated;

alter table public.travelers enable row level security;

create policy "travelers: members read"
  on public.travelers for select to authenticated
  using (public.is_trip_member(trip_id));

create policy "travelers: editors insert"
  on public.travelers for insert to authenticated
  with check (public.can_edit_trip(trip_id));

create policy "travelers: editors update"
  on public.travelers for update to authenticated
  using (public.can_edit_trip(trip_id))
  with check (public.can_edit_trip(trip_id));
