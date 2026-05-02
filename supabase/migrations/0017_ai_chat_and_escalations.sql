-- Student AI chat + hybrid coordinator escalation.
--
-- Reuses the existing application_messages table for one unified thread that
-- carries student / AI / coordinator turns. AI rows have author_id NULL and
-- author_role='ai'. A new `kind` column lets the coordinator UI distinguish
-- a pinned escalation summary from regular chat.
--
-- Three new columns on applications track escalation lifecycle:
--   escalation_pending     — boolean, true while a coordinator should be
--                            looking at this thread regardless of status.
--   escalation_opened_at   — timestamptz of the first escalation event.
--   escalation_resolved_at — timestamptz of the most recent resolution.
--
-- The hybrid model: student keeps filling steps and can submit normally.
-- Escalation just FLAGS the application so coordinators see it on a Triage
-- inbox tab even when the application is still in `draft`. Status is NOT
-- changed by escalating.
--
-- Idempotent / re-runnable.

-- ─────────────────────────────────────────────────────────────────────────────
-- application_messages — widen author_role + allow nullable author_id (for AI)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing role check (whatever its name) and re-add it with 'ai'.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.application_messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%author_role%'
  ) then
    execute (
      select 'alter table public.application_messages drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.application_messages'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%author_role%'
      limit 1
    );
  end if;
end$$;

alter table public.application_messages
  add constraint application_messages_author_role_check
  check (author_role in ('student', 'coordinator', 'ai'));

-- Allow author_id NULL for AI rows (AI is a system entity, not an auth.users row).
alter table public.application_messages
  alter column author_id drop not null;

-- New `kind` column: 'chat' for normal turns, 'escalation_summary' for the
-- pinned summary the AI generates when a student escalates. Default 'chat'.
alter table public.application_messages
  add column if not exists kind text not null default 'chat'
  check (kind in ('chat', 'escalation_summary'));

create index if not exists application_messages_kind_idx
  on public.application_messages (application_id, kind, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- applications — add escalation lifecycle columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.applications
  add column if not exists escalation_pending boolean not null default false;
alter table public.applications
  add column if not exists escalation_opened_at timestamptz;
alter table public.applications
  add column if not exists escalation_resolved_at timestamptz;

create index if not exists applications_escalation_pending_idx
  on public.applications (escalation_pending) where escalation_pending = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — let the student READ AI messages on their own application. Inserts
-- by AI happen via the service-role client (bypasses RLS), so no INSERT
-- policy is needed for kind='chat' role='ai' rows. The existing
-- messages_select_owner_or_staff policy already covers reads.
-- ─────────────────────────────────────────────────────────────────────────────

-- Realtime — application_messages is already in the publication per 0013.
-- Adding 'kind' to the row payload is automatic since publication uses
-- replica identity full (per 0015). No further realtime config needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- glm_reasoning_trace — widen the endpoint check to accept 'student_chat'.
-- (0016 already widened it for 'coassist'; this just adds the new value.)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.glm_reasoning_trace'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%endpoint%'
  ) then
    execute (
      select 'alter table public.glm_reasoning_trace drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'public.glm_reasoning_trace'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%endpoint%'
      limit 1
    );
  end if;
end$$;

alter table public.glm_reasoning_trace
  add constraint glm_reasoning_trace_endpoint_check
  check (
    endpoint in (
      'intent', 'plan', 'adapt', 'route', 'parse', 'brief',
      'next_step', 'fill_letter', 'estimate_progress',
      'coassist',
      'student_chat'
    )
  );
