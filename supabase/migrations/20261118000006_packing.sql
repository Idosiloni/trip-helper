-- Bags and packing items (SPEC 6.3). Three states: need / packed / missing.
-- "Missing" shows as a "to buy" filter until purchases arrive (PLAN decision 3).

create table public.bags (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips (id) on delete cascade,
  label             text not null check (char_length(label) between 1 and 40),
  kind              public.bag_kind not null default 'suitcase',
  owner_traveler_id uuid,
  position          text collate "C" not null,
  deleted_at        timestamptz,
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, trip_id),
  foreign key (owner_traveler_id, trip_id) references public.travelers (id, trip_id) on delete set null (owner_traveler_id)
);

create table public.packing_items (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  category      text not null default 'other' check (char_length(category) <= 30),
  qty           int not null default 1 check (qty between 1 and 999),
  traveler_id   uuid,                        -- null = shared
  bag_id        uuid,
  state         public.packing_state not null default 'need',
  return_packed boolean not null default false,
  packed_by     uuid references public.profiles (id) on delete set null,
  packed_at     timestamptz,
  notes         text check (char_length(notes) <= 1000),
  source        public.item_source not null default 'manual',
  ai_import_id  uuid references public.ai_imports (id) on delete set null,
  position      text collate "C" not null,
  deleted_at    timestamptz,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (traveler_id, trip_id) references public.travelers (id, trip_id) on delete set null (traveler_id),
  foreign key (bag_id, trip_id) references public.bags (id, trip_id) on delete set null (bag_id)
);

create index bags_trip_idx on public.bags (trip_id);
create index packing_items_trip_idx on public.packing_items (trip_id);

create trigger bags_set_updated_at before update on public.bags
  for each row execute function public.set_updated_at();
create trigger packing_items_set_updated_at before update on public.packing_items
  for each row execute function public.set_updated_at();

-- packed_by / packed_at follow state; viewers may change only state and return_packed.
create or replace function public.packing_items_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.trip_id <> old.trip_id then
    raise exception 'trip_id is immutable' using errcode = '42501';
  end if;
  if (select auth.uid()) is not null and public.my_trip_role(new.trip_id) = 'viewer'
     and (new.title, new.category, new.qty, new.traveler_id, new.bag_id, new.notes, new.position, new.deleted_at, new.source)
         is distinct from
         (old.title, old.category, old.qty, old.traveler_id, old.bag_id, old.notes, old.position, old.deleted_at, old.source) then
    raise exception 'viewers can only mark their own items' using errcode = '42501';
  end if;
  if new.state is distinct from old.state then
    new.packed_by := case when new.state = 'packed' then (select auth.uid()) end;
    new.packed_at := case when new.state = 'packed' then now() end;
  end if;
  return new;
end;
$$;

create trigger packing_items_guard before update on public.packing_items
  for each row execute function public.packing_items_guard();

-- Feed: deletions, and "bag X fully packed" (not every single check, which is noise).
create or replace function public.packing_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.bags;
begin
  if public.in_bulk_write() then return null; end if;
  if new.deleted_at is not null and old.deleted_at is null then
    perform public.log_activity(new.trip_id, 'packing.deleted', 'packing_item', new.id, jsonb_build_object('title', new.title));
  elsif new.state = 'packed' and old.state <> 'packed' and new.bag_id is not null and new.deleted_at is null then
    if not exists (
      select 1 from public.packing_items
      where bag_id = new.bag_id and deleted_at is null and state <> 'packed'
    ) then
      select * into b from public.bags where id = new.bag_id;
      perform public.log_activity(new.trip_id, 'bag.packed', 'bag', b.id, jsonb_build_object('label', b.label));
    end if;
  end if;
  return null;
end;
$$;

create trigger packing_activity after update on public.packing_items
  for each row execute function public.packing_activity();

-- Can the caller (a viewer) mark this item? Their own item, or anything in their own bag.
create or replace function public.is_my_packing_item(p_traveler_id uuid, p_bag_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_my_traveler(p_traveler_id)
      or exists (select 1 from public.bags b where b.id = p_bag_id and public.is_my_traveler(b.owner_traveler_id));
$$;

revoke execute on function public.is_my_packing_item(uuid, uuid) from public, anon;
grant execute on function public.is_my_packing_item(uuid, uuid) to authenticated;

alter table public.bags enable row level security;
alter table public.packing_items enable row level security;

create policy "bags: members read" on public.bags for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "bags: editors insert" on public.bags for insert to authenticated
  with check (public.can_edit_trip(trip_id));
create policy "bags: editors update" on public.bags for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy "packing_items: members read" on public.packing_items for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "packing_items: editors insert" on public.packing_items for insert to authenticated
  with check (public.can_edit_trip(trip_id));
create policy "packing_items: editors update, viewers their own" on public.packing_items for update to authenticated
  using (public.can_edit_trip(trip_id)
         or (public.my_trip_role(trip_id) = 'viewer' and public.is_my_packing_item(traveler_id, bag_id)))
  with check (public.can_edit_trip(trip_id)
         or (public.my_trip_role(trip_id) = 'viewer' and public.is_my_packing_item(traveler_id, bag_id)));
