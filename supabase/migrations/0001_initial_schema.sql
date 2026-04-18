-- UniGuide initial schema
-- See docs/SAD.md "Normalized Database Schema" section for the ERD this implements.

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================================================
-- Users & profiles
-- ============================================================================
-- We use Supabase Auth's auth.users table for identity. Our own `users` table
-- mirrors id + adds role. Profiles split by role to avoid sparse columns.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('student', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  full_name text not null,
  faculty text,
  programme text,
  year int check (year between 1 and 8),
  cgpa numeric(3,2) check (cgpa between 0 and 4.00),
  citizenship text default 'MY',
  matric_no text unique
);

create table if not exists public.staff_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  full_name text not null,
  faculty text,
  staff_role text not null check (staff_role in ('coordinator', 'dean', 'dvc', 'ips_officer'))
);

-- ============================================================================
-- Procedures (the catalogue of UM admin procedures we support)
-- ============================================================================
create table if not exists public.procedures (
  id text primary key,             -- e.g., 'scholarship_application'
  name text not null,
  description text,
  source_url text,
  faculty_scope text,              -- e.g., 'FSKTM' or null for university-wide
  indexed_at timestamptz not null default now()
);

-- ============================================================================
-- Workflows (a student's instance of a procedure)
-- ============================================================================
create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  procedure_id text not null references public.procedures(id),
  status text not null default 'planning'
    check (status in ('planning', 'active', 'submitted', 'approved', 'rejected', 'cancelled')),
  intent_text text,
  plan_snapshot jsonb,             -- the workflow plan emitted by GLM, stored for replay/audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflows_user_id_idx on public.workflows(user_id);
create index if not exists workflows_status_idx on public.workflows(status);

-- ============================================================================
-- Workflow stages, steps, edges (instantiated from the GLM-emitted plan)
-- ============================================================================
create table if not exists public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  ordinal int not null,
  label text not null,
  node_type text not null default 'stage'
    check (node_type in ('stage', 'decision', 'end')),
  status text not null default 'locked'
    check (status in ('locked', 'active', 'completed', 'skipped')),
  assignee_role text,              -- 'student' | 'coordinator' | 'dean' | etc.
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, ordinal)
);

create index if not exists workflow_stages_workflow_idx on public.workflow_stages(workflow_id);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.workflow_stages(id) on delete cascade,
  ordinal int not null,
  type text not null check (type in ('form', 'upload', 'approval', 'notification', 'conditional')),
  label text not null,
  config jsonb not null default '{}'::jsonb,
  required boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'skipped')),
  created_at timestamptz not null default now()
);

create index if not exists workflow_steps_stage_idx on public.workflow_steps(stage_id);

create table if not exists public.workflow_edges (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  source_stage_id uuid not null references public.workflow_stages(id) on delete cascade,
  target_stage_id uuid not null references public.workflow_stages(id) on delete cascade,
  condition_key text,              -- e.g., 'approved' | 'rejected' | 'family_owned' | null=unconditional
  label text,
  check (source_stage_id <> target_stage_id)
);

create index if not exists workflow_edges_source_idx on public.workflow_edges(source_stage_id);

-- ============================================================================
-- Step responses (student's answers, file uploads, approvals)
-- ============================================================================
create table if not exists public.step_responses (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.workflow_steps(id) on delete cascade,
  user_id uuid not null references public.users(id),
  response_data jsonb not null default '{}'::jsonb,
  responded_at timestamptz not null default now(),
  unique (step_id)                 -- one response per step (simple model for MVP)
);

-- ============================================================================
-- Attachments (uploaded documents)
-- ============================================================================
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  step_id uuid references public.workflow_steps(id) on delete set null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  extracted_fields jsonb,          -- populated by parseDocument
  uploaded_at timestamptz not null default now()
);

create index if not exists attachments_workflow_idx on public.attachments(workflow_id);

-- ============================================================================
-- GLM reasoning trace (audit log for every model call)
-- See SAD.md "GLM as Service Layer" — every endpoint writes to this table.
-- ============================================================================
create table if not exists public.glm_reasoning_trace (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows(id) on delete cascade,
  endpoint text not null check (endpoint in
    ('intent', 'plan', 'adapt', 'route', 'parse', 'brief')),
  model_version text not null,
  prompt_hash text not null,
  input_summary jsonb,             -- redacted input (no PII stored verbatim)
  output jsonb,
  confidence numeric,
  citations text[] default '{}',
  citation_verified boolean default true,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  cache_hit boolean default false,
  retry_count int default 0,
  called_at timestamptz not null default now()
);

create index if not exists glm_trace_workflow_idx on public.glm_reasoning_trace(workflow_id);
create index if not exists glm_trace_called_at_idx on public.glm_reasoning_trace(called_at desc);

-- ============================================================================
-- Admin briefings (GLM-prepared summaries of submissions)
-- ============================================================================
create table if not exists public.admin_briefings (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  extracted_facts jsonb not null,
  flags jsonb default '[]'::jsonb,                       -- array of { severity, message, source_step_id }
  recommendation text not null check (recommendation in
    ('approve', 'reject', 'request_info')),
  reasoning text not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists admin_briefings_status_idx on public.admin_briefings(status);

create table if not exists public.admin_decisions (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.admin_briefings(id) on delete cascade,
  staff_user_id uuid not null references public.users(id),
  decision text not null check (decision in ('approve', 'reject', 'request_info')),
  comment text,
  decided_at timestamptz not null default now()
);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger workflows_updated_at
  before update on public.workflows
  for each row execute function public.set_updated_at();

create trigger workflow_stages_updated_at
  before update on public.workflow_stages
  for each row execute function public.set_updated_at();
