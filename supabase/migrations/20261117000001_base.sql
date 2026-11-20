-- Base: shared enums and helpers used by every later migration.

create type public.trip_role as enum ('owner', 'editor', 'viewer');
create type public.trip_phase as enum ('before', 'during', 'after');

-- Keeps updated_at honest on every UPDATE, whatever the client sends.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
