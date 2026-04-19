-- Storage bucket for student-uploaded application files (income proofs, transcripts, etc.)
-- Path scheme: {user_id}/{application_id}/{step_id}-{filename}
-- Owner uploads & reads their own files; staff/admin read all.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-files',
  'application-files',
  false,
  10 * 1024 * 1024,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- INSERT: authenticated user can upload only into a folder matching their own user id.
drop policy if exists "application_files_insert_own" on storage.objects;
create policy "application_files_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'application-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: owner reads their own files; staff/admin read everything.
drop policy if exists "application_files_select_own_or_staff" on storage.objects;
create policy "application_files_select_own_or_staff"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role in ('staff','admin')
      )
    )
  );

-- DELETE: owner can delete their own; staff cannot.
drop policy if exists "application_files_delete_own" on storage.objects;
create policy "application_files_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'application-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
