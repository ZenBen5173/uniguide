-- Widen the glm_reasoning_trace.endpoint CHECK constraint to cover the v2
-- endpoints that have been live since the application engine rewrite, plus
-- the new `coassist` endpoint introduced for coordinator natural-language
-- artifact revision (decision letter / proposed step / briefing reasoning).
--
-- The original 0001_initial_schema.sql constraint only accepted the v1
-- endpoints {intent, plan, adapt, route, parse, brief}. Writes from
-- next_step, fill_letter, estimate_progress have been silently bouncing
-- (writeTrace catches and logs). This migration brings the schema in line
-- with the code's TraceEndpoint enum.
--
-- Idempotent: safely re-runnable. The DROP CONSTRAINT is conditional via
-- pg_constraint lookup; the ADD CONSTRAINT uses a unique name so a re-run
-- that drops + re-adds is a no-op in steady state.

do $$
begin
  -- Drop any existing endpoint check (whatever its name).
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
      -- v1 endpoints — kept for trace-history compatibility
      'intent', 'plan', 'adapt', 'route', 'parse', 'brief',
      -- v2 endpoints (application engine rewrite)
      'next_step', 'fill_letter', 'estimate_progress',
      -- coassist (this PR)
      'coassist'
    )
  );
