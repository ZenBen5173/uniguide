-- Widen glm_reasoning_trace.endpoint to accept 'judge_letter'.
--
-- The judgeLetter endpoint runs as a second-layer hallucination check on
-- filled decision letters. It runs after fillLetter (which produces the
-- draft) and after the regex layer (which catches structural mismatches),
-- and surfaces semantic problems regex can't see: fabricated policy,
-- contradicted briefing, invented committee names, etc.
--
-- Without this migration, judgeLetter trace writes silently bounce
-- (writeTrace catches and logs). Bringing the constraint in line with the
-- code's TraceEndpoint enum.
--
-- Idempotent / re-runnable. Same drop-and-readd pattern as 0016 / 0017.

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
      'student_chat',
      'judge_letter'
    )
  );
