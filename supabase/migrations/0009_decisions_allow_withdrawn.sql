-- Allow application_decisions.decision = 'withdrawn' so student-initiated
-- cancellations show up in the same audit trail as coordinator decisions.

alter table public.application_decisions
  drop constraint if exists application_decisions_decision_check;

alter table public.application_decisions
  add constraint application_decisions_decision_check
  check (decision = any (array['approve', 'reject', 'request_info', 'withdrawn']));
