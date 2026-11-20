-- Every pasted chat answer that was imported, for recovery and prompt tuning.
-- Rows are written only by commit_import().

create table public.ai_imports (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references public.trips (id) on delete cascade,
  prompt_id      text not null,          -- 'p04-packing', or 'paste' for a plain pasted list
  prompt_version int not null default 0,
  kind           text not null check (kind in ('tasks', 'packing', 'places', 'itinerary', 'purchases', 'notes', 'bookings')),
  source_label   text,                   -- 'ChatGPT' / 'Claude' / 'Gemini' / null
  raw_text       text not null check (char_length(raw_text) <= 200000),
  parsed         jsonb,
  accepted_count int not null default 0,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

create index ai_imports_trip_idx on public.ai_imports (trip_id, created_at desc);

alter table public.ai_imports enable row level security;

create policy "ai_imports: members read"
  on public.ai_imports for select to authenticated
  using (public.is_trip_member(trip_id));
