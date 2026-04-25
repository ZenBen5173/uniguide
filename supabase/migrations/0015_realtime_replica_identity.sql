-- Realtime UPDATE events with row-level filters need REPLICA IDENTITY FULL.
--
-- Problem: SmartApplication subscribes to `applications` updates with
--   filter: `id=eq.<uuid>` so the student page can re-fetch when the
-- coordinator approves / rejects / requests-info. With the default
-- REPLICA IDENTITY (PRIMARY KEY only), Postgres' WAL only includes the
-- primary key on UPDATEs, so Supabase Realtime can't evaluate the filter
-- against the row's `id` column at decode time and the event is silently
-- dropped. INSERTs are unaffected (full row is in the WAL by default).
--
-- Symptom this fixes:
--  - Coordinator hits Approve / Reject / Request Info → student does not
--    see the status flip or the new step until they hard-refresh.
--  - Coordinator updates an application_step config → student doesn't see it.
--
-- Cost of REPLICA IDENTITY FULL: each UPDATE writes the full old-row image
-- to the WAL, so logical replication is slightly larger. For our table
-- volumes (a few thousand rows worst-case) this is a non-issue and well
-- worth the realtime correctness.

alter table public.applications        replica identity full;
alter table public.application_steps   replica identity full;
alter table public.application_letters replica identity full;
alter table public.application_messages replica identity full;
