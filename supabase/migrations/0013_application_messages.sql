-- Persistent message thread between student and coordinator on an application.
-- Distinct from:
--  - application_steps (the formal flow)
--  - application_coordinator_notes (staff-only private notes)
--  - application_letters (formal decision letters)
--
-- Use case: ad-hoc questions. "Can I extend my deadline?" / "When will the
-- decision come?" — quick chat that doesn't fit the structured step flow.

create table public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_role text not null check (author_role in ('student','coordinator')),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index application_messages_application_id_idx
  on public.application_messages (application_id, created_at);

alter table public.application_messages enable row level security;

-- SELECT: owner of the application OR staff/admin
drop policy if exists "messages_select_owner_or_staff" on public.application_messages;
create policy "messages_select_owner_or_staff"
  on public.application_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and (
          a.user_id = auth.uid()
          or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.role in ('staff','admin')
          )
        )
    )
  );

-- INSERT student
drop policy if exists "messages_insert_student" on public.application_messages;
create policy "messages_insert_student"
  on public.application_messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and author_role = 'student'
    and exists (
      select 1 from public.applications a
      where a.id = application_id and a.user_id = auth.uid()
    )
  );

-- INSERT coordinator
drop policy if exists "messages_insert_coordinator" on public.application_messages;
create policy "messages_insert_coordinator"
  on public.application_messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and author_role = 'coordinator'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('staff','admin')
    )
  );

-- Realtime publication for instant chat
alter publication supabase_realtime add table public.application_messages;
