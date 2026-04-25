-- Backfill of v2 application tables.
--
-- Why this exists: during early v2 development the `applications`,
-- `application_steps`, `application_briefings`, `application_decisions`,
-- `application_letters`, and `procedure_letter_templates` tables were
-- created via Supabase Studio directly against the live DB, and the
-- generated migrations were never committed to git. Anyone running
-- `supabase db reset` from a fresh checkout would hit a broken schema
-- (the migration sequence jumped from 0004 → 0007).
--
-- This migration codifies what was created off-track. Every statement is
-- idempotent (`IF NOT EXISTS` / `DROP IF EXISTS` / `CREATE OR REPLACE`)
-- so re-running on the live DB is a safe no-op. Constraint names and
-- index names match production exactly.
--
-- 0009_decisions_allow_withdrawn.sql layers on the 'withdrawn' decision
-- variant; 0011_application_assignee.sql adds applications.assigned_to
-- and applications.assigned_at. Both are already idempotent so they
-- compose cleanly with this file on a fresh install.

-- ============================================================================
-- Helper: owns_application(uuid) — used by RLS on app-side tables
-- ============================================================================
create or replace function public.owns_application(app_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.applications
    where id = app_id and user_id = auth.uid()
  );
$$;

-- 0003 defined is_staff() to check role = 'staff' only. v2 needs admin
-- to count as staff for inbox / SOP / template management; redefining
-- with the broader check.
create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('staff', 'admin')
  );
$$;

-- ============================================================================
-- applications — one row per student journey through a procedure
-- ============================================================================
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  procedure_id text not null references public.procedures(id),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'more_info_requested', 'approved', 'rejected', 'withdrawn')),
  progress_current_step int default 0,
  progress_estimated_total int,
  student_summary text,
  ai_recommendation text
    check (ai_recommendation in ('approve', 'reject', 'request_info') or ai_recommendation is null),
  ai_confidence numeric,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
  -- assigned_to / assigned_at columns added by 0011_application_assignee.sql
);

create index if not exists applications_user_id_idx       on public.applications (user_id);
create index if not exists applications_procedure_id_idx  on public.applications (procedure_id);
create index if not exists applications_status_idx        on public.applications (status);

alter table public.applications enable row level security;

drop policy if exists applications_select        on public.applications;
drop policy if exists applications_insert_self   on public.applications;
drop policy if exists applications_update_self   on public.applications;

create policy applications_select on public.applications
  for select using (user_id = auth.uid() or public.is_staff());

create policy applications_insert_self on public.applications
  for insert with check (user_id = auth.uid());

create policy applications_update_self on public.applications
  for update using (user_id = auth.uid() or public.is_staff());

-- ============================================================================
-- application_steps — one row per AI- or coordinator-emitted step
-- ============================================================================
create table if not exists public.application_steps (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  ordinal int not null,
  type text not null
    check (type in ('form', 'file_upload', 'text', 'select', 'multiselect', 'info', 'final_submit', 'coordinator_message')),
  prompt_text text not null,
  config jsonb not null default '{}'::jsonb,
  emitted_by text not null default 'ai'
    check (emitted_by in ('ai', 'coordinator')),
  emitted_by_user_id uuid references public.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  response_data jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (application_id, ordinal)
);

create index if not exists application_steps_application_idx on public.application_steps (application_id);
create index if not exists application_steps_status_idx      on public.application_steps (status);

alter table public.application_steps enable row level security;

drop policy if exists application_steps_access on public.application_steps;
create policy application_steps_access on public.application_steps
  for all using (public.owns_application(application_id) or public.is_staff());

-- ============================================================================
-- application_briefings — coordinator-side AI digest of submitted application
-- ============================================================================
create table if not exists public.application_briefings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  extracted_facts jsonb not null,
  flags jsonb default '[]'::jsonb,
  recommendation text not null
    check (recommendation in ('approve', 'reject', 'request_info')),
  reasoning text not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists application_briefings_app_idx    on public.application_briefings (application_id);
create index if not exists application_briefings_status_idx on public.application_briefings (status);

alter table public.application_briefings enable row level security;

drop policy if exists application_briefings_staff on public.application_briefings;
create policy application_briefings_staff on public.application_briefings
  for select using (public.is_staff());

-- ============================================================================
-- application_decisions — coordinator approve/reject/request_info audit trail
-- ============================================================================
create table if not exists public.application_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  briefing_id uuid references public.application_briefings(id),
  decided_by uuid not null references public.users(id),
  decision text not null
    check (decision in ('approve', 'reject', 'request_info')),
  -- 0009_decisions_allow_withdrawn.sql expands the check to include 'withdrawn'
  comment text,
  decided_at timestamptz not null default now()
);

create index if not exists application_decisions_app_idx on public.application_decisions (application_id);

alter table public.application_decisions enable row level security;

drop policy if exists application_decisions_staff on public.application_decisions;
create policy application_decisions_staff on public.application_decisions
  for all using (public.is_staff());

-- ============================================================================
-- procedure_letter_templates — admin-managed letter templates per procedure
-- ============================================================================
create table if not exists public.procedure_letter_templates (
  id uuid primary key default gen_random_uuid(),
  procedure_id text not null references public.procedures(id) on delete cascade,
  template_type text not null
    check (template_type in ('acceptance', 'rejection', 'request_info', 'custom')),
  name text not null,
  template_text text,
  template_storage_path text,
  detected_placeholders text[] default '{}'::text[],
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (procedure_id, template_type, name)
);

create index if not exists procedure_letter_templates_procedure_idx
  on public.procedure_letter_templates (procedure_id);

alter table public.procedure_letter_templates enable row level security;

drop policy if exists procedure_letter_templates_staff on public.procedure_letter_templates;
create policy procedure_letter_templates_staff on public.procedure_letter_templates
  for all using (public.is_staff());

-- ============================================================================
-- application_letters — generated letters delivered to students
-- ============================================================================
create table if not exists public.application_letters (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  template_id uuid references public.procedure_letter_templates(id),
  letter_type text not null
    check (letter_type in ('acceptance', 'rejection', 'request_info', 'custom')),
  generated_text text not null,
  pdf_storage_path text,
  delivered_to_student_at timestamptz,
  delivered_via_email boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists application_letters_app_idx on public.application_letters (application_id);

alter table public.application_letters enable row level security;

drop policy if exists application_letters_access on public.application_letters;
create policy application_letters_access on public.application_letters
  for select using (public.owns_application(application_id) or public.is_staff());
