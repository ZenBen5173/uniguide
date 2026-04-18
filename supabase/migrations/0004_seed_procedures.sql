-- Seed the procedure catalogue.
-- Actual SOP chunks are inserted by `scripts/seed-kb.ts` after embeddings are computed.

insert into public.procedures (id, name, description, source_url, faculty_scope) values
  (
    'scholarship_application',
    'Scholarship & Financial Aid Application',
    'UM-internal (Yayasan UM, IPS Bright Sparks), government (JPA, MARA, MyBrainSc), and corporate (Khazanah, BNM, Petronas) scholarship applications, with eligibility filtering by CGPA, citizenship, and family income tier.',
    'https://hep.um.edu.my/scholarship',
    null
  ),
  (
    'final_year_project',
    'Final Year Project (FYP)',
    'WIA3001/WIA3002 — topic browsing, supervisor matching, proposal defence, ethics review (UMREC), Turnitin, viva voce.',
    'https://ilmiah.fsktm.um.edu.my/',
    'FSKTM'
  ),
  (
    'deferment_of_studies',
    'Deferment of Studies (Penangguhan Pengajian)',
    'Bachelor''s Regulations Reg.4 — application to defer studies for medical, financial, family, or other approved reasons.',
    'https://hep.um.edu.my/URUSAN%20TATATERTIB/UNIVERSITY%20OF%20MALAYA%20(BACHELOR%27S%20DEGREE)%20REGULATIONS%202019.pdf',
    null
  ),
  (
    'exam_result_appeal',
    'Examination Result Appeal',
    'Bachelor''s Regulations Reg.40 — formal appeal for review of an examination grade. Strict 2-week window.',
    'https://hep.um.edu.my/URUSAN%20TATATERTIB/UNIVERSITY%20OF%20MALAYA%20(BACHELOR%27S%20DEGREE)%20REGULATIONS%202019.pdf',
    null
  ),
  (
    'postgrad_admission',
    'Postgraduate Admission & Supervisor Matching',
    'IPS coordinated postgraduate admission for Master''s and PhD candidates (research, coursework, mixed mode).',
    'https://study.um.edu.my/',
    null
  ),
  (
    'emgs_visa_renewal',
    'EMGS Student Pass Renewal',
    'International student pass renewal coordinated through Education Malaysia Global Services (EMGS) and UM ISC. Start 3 months before expiry.',
    'https://visa.educationmalaysia.gov.my/',
    null
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  source_url = excluded.source_url,
  indexed_at = now();
