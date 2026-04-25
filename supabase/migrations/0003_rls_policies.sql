-- Row Level Security: every table on, every policy explicit.
-- See docs/SAD.pdf "Security" NFR.

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================
alter table public.users enable row level security;
alter table public.student_profiles enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_sop_chunks enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_stages enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.workflow_edges enable row level security;
alter table public.step_responses enable row level security;
alter table public.attachments enable row level security;
alter table public.glm_reasoning_trace enable row level security;
alter table public.admin_briefings enable row level security;
alter table public.admin_decisions enable row level security;

-- ============================================================================
-- Helpers
-- ============================================================================
create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'staff'
  );
$$;

create or replace function public.owns_workflow(wf_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.workflows
    where id = wf_id and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- users / profiles — users see themselves; staff see all (read-only)
-- ============================================================================
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_staff());

create policy student_profiles_select_self on public.student_profiles
  for select using (user_id = auth.uid() or public.is_staff());

create policy student_profiles_update_self on public.student_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy staff_profiles_select_self on public.staff_profiles
  for select using (user_id = auth.uid() or public.is_staff());

-- ============================================================================
-- procedures + KB chunks — readable by all authenticated users
-- ============================================================================
create policy procedures_select_all on public.procedures
  for select using (auth.uid() is not null);

create policy procedure_sop_chunks_select_all on public.procedure_sop_chunks
  for select using (auth.uid() is not null);

-- ============================================================================
-- workflows — owner OR any staff
-- ============================================================================
create policy workflows_select on public.workflows
  for select using (user_id = auth.uid() or public.is_staff());

create policy workflows_insert_self on public.workflows
  for insert with check (user_id = auth.uid());

create policy workflows_update_self on public.workflows
  for update using (user_id = auth.uid() or public.is_staff());

-- ============================================================================
-- workflow_stages / steps / edges — same access as parent workflow
-- ============================================================================
create policy workflow_stages_access on public.workflow_stages
  for all using (
    public.owns_workflow(workflow_id) or public.is_staff()
  );

create policy workflow_steps_access on public.workflow_steps
  for all using (
    exists (
      select 1 from public.workflow_stages s
      where s.id = stage_id
        and (public.owns_workflow(s.workflow_id) or public.is_staff())
    )
  );

create policy workflow_edges_access on public.workflow_edges
  for all using (
    public.owns_workflow(workflow_id) or public.is_staff()
  );

-- ============================================================================
-- step_responses — owner of the workflow OR staff
-- ============================================================================
create policy step_responses_access on public.step_responses
  for all using (
    user_id = auth.uid() or public.is_staff()
  );

-- ============================================================================
-- attachments — owner of the workflow OR staff
-- ============================================================================
create policy attachments_access on public.attachments
  for all using (
    public.owns_workflow(workflow_id) or public.is_staff()
  );

-- ============================================================================
-- glm_reasoning_trace — readable by workflow owner OR staff; insert by service role only
-- ============================================================================
create policy glm_trace_select on public.glm_reasoning_trace
  for select using (
    public.owns_workflow(workflow_id) or public.is_staff()
  );

-- (insert/update via service role; no policy = denied for anon/auth users)

-- ============================================================================
-- admin_briefings + admin_decisions — staff only
-- ============================================================================
create policy admin_briefings_staff on public.admin_briefings
  for select using (public.is_staff());

create policy admin_decisions_staff on public.admin_decisions
  for all using (public.is_staff());
