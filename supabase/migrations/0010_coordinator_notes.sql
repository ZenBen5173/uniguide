-- Internal notes coordinators can leave on an application. Never shown to
-- the student — purely a private workspace for the office. Useful for
-- "checked with finance: 2024 income different from 2023" type observations
-- that don't belong in the formal letter.

create table public.application_coordinator_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index application_coordinator_notes_application_id_idx
  on public.application_coordinator_notes (application_id, created_at desc);

alter table public.application_coordinator_notes enable row level security;

-- Only staff and admin can read these notes.
drop policy if exists "coord_notes_select_staff" on public.application_coordinator_notes;
create policy "coord_notes_select_staff"
  on public.application_coordinator_notes for select
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('staff','admin')
    )
  );

-- Same for inserts; author_id must match the inserter.
drop policy if exists "coord_notes_insert_self" on public.application_coordinator_notes;
create policy "coord_notes_insert_self"
  on public.application_coordinator_notes for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('staff','admin')
    )
  );

-- Author can delete their own notes.
drop policy if exists "coord_notes_delete_own" on public.application_coordinator_notes;
create policy "coord_notes_delete_own"
  on public.application_coordinator_notes for delete
  to authenticated
  using (author_id = auth.uid());
