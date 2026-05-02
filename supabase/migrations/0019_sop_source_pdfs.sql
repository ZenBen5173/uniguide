-- Storage bucket for the original SOP PDFs admins upload, plus a column on
-- procedures pointing at the stored file.
--
-- Today the admin upload flow runs the PDF through pdf-parse, drops the
-- extracted text into the SOP textbox, and discards the file. There's no
-- way to look at the original PDF afterwards — so the procedure detail
-- page can't surface "View original PDF" and any later disagreement about
-- what the SOP actually said requires going back to the admin who pasted
-- the URL (if there even was one).
--
-- This migration:
--   1. Adds procedures.source_pdf_path — nullable storage path inside the
--      `sop-sources` bucket (matches the {procedure_id}/{filename} scheme
--      used by parse-pdf below).
--   2. Creates the `sop-sources` bucket. Public:false; we'll mint signed
--      URLs server-side when surfacing the file. PDF only, 10 MB cap.
--   3. RLS: only admin can write; staff + admin (and authenticated users
--      who have access to the procedure) can read. Students CAN see SOPs
--      because that's the whole "transparent SOP" pitch — the source PDF
--      lives behind the same realm.
--
-- Idempotent / re-runnable.

-- 1. Column on procedures.
alter table public.procedures
  add column if not exists source_pdf_path text;

-- 2. Bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-sources',
  'sop-sources',
  false,
  10 * 1024 * 1024,
  array['application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Policies.
-- INSERT — admin only. The route uses service-role for upload so this is
-- defence-in-depth rather than the only gate.
drop policy if exists "sop_sources_insert_admin" on storage.objects;
create policy "sop_sources_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sop-sources'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- SELECT — any authenticated user. SOPs are public-facing reference material
-- by design (the student-side "View source SOP" panel surfaces them); we
-- don't gate by procedure here since procedures themselves aren't gated.
drop policy if exists "sop_sources_select_authenticated" on storage.objects;
create policy "sop_sources_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'sop-sources');

-- UPDATE / DELETE — admin only.
drop policy if exists "sop_sources_modify_admin" on storage.objects;
create policy "sop_sources_modify_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sop-sources'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

drop policy if exists "sop_sources_delete_admin" on storage.objects;
create policy "sop_sources_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sop-sources'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
