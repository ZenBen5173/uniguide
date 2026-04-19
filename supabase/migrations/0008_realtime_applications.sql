-- Enable Supabase Realtime for student-facing application tables.
-- The student SmartApplication page subscribes to these so status flips
-- (under_review → approved/rejected/more_info_requested) appear instantly
-- without a manual refresh.

alter publication supabase_realtime add table public.applications;
alter publication supabase_realtime add table public.application_steps;
alter publication supabase_realtime add table public.application_letters;
