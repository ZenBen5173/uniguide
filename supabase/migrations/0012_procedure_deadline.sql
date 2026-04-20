-- Per-procedure deadline metadata. Two fields:
-- 1. deadline_date — the actual cutoff (NULL if rolling/ongoing)
-- 2. deadline_label — human-readable text shown on the portal/application
--    (e.g. "30 April 2026 · 23:59 MYT" or "Within 14 days of CGPA release")
-- Both nullable; admins can set either or neither.

alter table public.procedures
  add column if not exists deadline_date timestamptz,
  add column if not exists deadline_label text;
