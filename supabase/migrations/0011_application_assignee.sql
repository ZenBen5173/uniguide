-- Optional coordinator assignment per application. Lets one coordinator
-- "claim" a row so others know it's in their lane, and surfaces who's
-- responsible in the inbox. Soft signal — RLS still allows any staff/admin
-- to act on any application; the column is purely organisational.

alter table public.applications
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz;

create index if not exists applications_assigned_to_idx on public.applications (assigned_to);
