/**
 * POST /api/demo/reset
 *
 * Full canonical-state restore for the demo. Wipes everything that can drift
 * during testing and reseeds the canonical baseline:
 *  - ALL applications (not just demo-student's) — catches apps created by
 *    OTP-signup users during testing
 *  - ALL letter templates (re-upserted from canonical below)
 *  - Non-canonical procedures (any procedure not in CANONICAL_PROCEDURES;
 *    catches admin-created test procedures like "asfasd")
 *  - Orphan GLM reasoning traces
 *
 * Then reseeds:
 *  - Canonical letter templates for each Live procedure
 *  - 8 sample applications spread across 5 procedures in distinct states:
 *      Scholarship: 3 (mid-flow draft, low-conf+flagged submitted, approved+letter)
 *      FYP:         2 (submitted with high-conf approve briefing; near-complete draft for the upload-and-submit demo)
 *      Deferment:   1 (approved with letter)
 *      Postgrad:    1 (submitted, high-confidence)
 *      Exam Appeal: 1 (more_info_requested)
 *  - Sample chat messages on the FYP submission for richness
 *
 * Why 3 scholarships (not 5): earlier the seed had 5 scholarships covering
 * draft / high-conf-approve / low-conf+block / approved+letter / rejected+letter.
 * The 5 cards on the student portal looked like duplicates because the procedure
 * name was the same. Trimmed to 3 distinct lifecycle states; the high-conf and
 * rejected examples were redundant given FYP/Postgrad submitted (high-conf) and
 * Exam Appeal (non-approve outcome).
 *
 * Canonical procedures + their procedure_sop_chunks are preserved (those are
 * config maintained via supabase/migrations and lib/kb/seed/). Only NEW
 * procedures created via the admin UI get nuked.
 *
 * Anyone can call this — only touches data, not user accounts.
 */

const CANONICAL_PROCEDURE_IDS = [
  "scholarship_application",
  "postgrad_admission",
  "final_year_project",
  "deferment_of_studies",
  "exam_result_appeal",
  "emgs_visa_renewal",
];

import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const DEMO_STUDENT_EMAIL = "demo-student@uniguide.local";
const DEMO_COORD_EMAIL = "demo-coordinator@uniguide.local";

const acceptanceLetterText = `Dear {{full_name}},

We are pleased to inform you that your application for the Yayasan UM Scholarship has been APPROVED.

Based on our review, you meet the eligibility criteria as a B40 student with strong academic standing. The scholarship will cover your full tuition for the upcoming academic year.

Please confirm acceptance by signing the attached offer letter within 14 days. The briefing session will be held at FSKTM on the date listed in the letter.

Yours sincerely,
Yayasan UM Scholarship Office
Universiti Malaya`;

const rejectionLetterText = `Dear {{full_name}},

After careful review, we regret to inform you that your application for the Yayasan UM Scholarship was not successful this round.

The primary reason is that your CGPA falls below the threshold required for the renewal-eligible scholarship pathway you applied for.

You may appeal this decision under Reg. 40 within 14 days of receiving this letter, or re-apply next semester after improving your CGPA.

Yours sincerely,
Yayasan UM Scholarship Office
Universiti Malaya`;

const defermentApprovedText = `Dear {{full_name}},

Your application for deferment of studies under Reg. 41 has been APPROVED.

Approved deferment period: 1 academic year (2 semesters), commencing the next semester following your application date. Your return semester is recorded as Semester 1, 2026/2027.

You must notify your Programme Coordinator at least 4 weeks before the start of the return semester to coordinate course re-registration. International students must additionally renew their EMGS visa before the return semester.

If you do not return by the agreed semester without applying for an extension, you will be deemed to have withdrawn from the programme.

Yours sincerely,
Deputy Vice-Chancellor (Academic & International)
Universiti Malaya`;

interface SeedTemplate {
  procedure_id: string;
  template_type: "acceptance" | "rejection" | "request_info";
  name: string;
  template_text: string;
}

const CANONICAL_TEMPLATES: SeedTemplate[] = [
  // Scholarship
  { procedure_id: "scholarship_application", template_type: "acceptance", name: "Standard B40 acceptance letter", template_text: acceptanceLetterText },
  { procedure_id: "scholarship_application", template_type: "rejection", name: "Standard rejection (CGPA threshold)", template_text: rejectionLetterText },
  // FYP
  { procedure_id: "final_year_project", template_type: "acceptance", name: "FYP I registration confirmation", template_text: `Dear {{full_name}},\n\nYour FYP I registration has been confirmed.\n\nProject category: {{project_category}}\nSupervisor: {{supervisor_name}}\nProject title: {{project_title}}\n\nYou are now officially registered for FYP I in MAYA. The mid-semester progress report is due Week 8; final submission and viva are due Week 14.\n\n{{coordinator_comment}}\n\nYours sincerely,\nFYP Coordinator, FSKTM\nUniversiti Malaya` },
  { procedure_id: "final_year_project", template_type: "rejection", name: "FYP I registration declined", template_text: `Dear {{full_name}},\n\nYour FYP I registration cannot be processed at this time.\n\n{{coordinator_comment}}\n\nPlease address the issue and resubmit before the Week 2 add/drop deadline. After Week 2, you will need to defer FYP to the next project semester.\n\nYours sincerely,\nFYP Coordinator, FSKTM\nUniversiti Malaya` },
  // Deferment
  { procedure_id: "deferment_of_studies", template_type: "acceptance", name: "Deferment approved (1 academic year)", template_text: defermentApprovedText },
  { procedure_id: "deferment_of_studies", template_type: "rejection", name: "Deferment declined", template_text: `Dear {{full_name}},\n\nYour application for deferment of studies has been declined.\n\n{{coordinator_comment}}\n\nYou may submit a new application addressing the issues identified above. Please consult your Programme Coordinator before resubmitting.\n\nYours sincerely,\nDeputy Vice-Chancellor (Academic & International)\nUniversiti Malaya` },
  // Postgrad
  { procedure_id: "postgrad_admission", template_type: "acceptance", name: "Postgrad offer of admission", template_text: `Dear {{full_name}},\n\nWe are pleased to offer you admission to the postgraduate programme at Universiti Malaya.\n\n{{coordinator_comment}}\n\nPlease confirm acceptance by signing and returning the attached offer letter within 21 days. International students should begin the EMGS visa application process immediately.\n\nYours sincerely,\nInstitute for Postgraduate Studies (IPS)\nUniversiti Malaya` },
  { procedure_id: "postgrad_admission", template_type: "rejection", name: "Postgrad application unsuccessful", template_text: `Dear {{full_name}},\n\nAfter careful review, we regret to inform you that your postgraduate application has not been successful this round.\n\n{{coordinator_comment}}\n\nYou may reapply for the next intake. Strengthening your supervisor match and research proposal is the most common path to a successful reapplication.\n\nYours sincerely,\nInstitute for Postgraduate Studies (IPS)\nUniversiti Malaya` },
  // Exam appeal
  { procedure_id: "exam_result_appeal", template_type: "acceptance", name: "Reg. 40 review — grade revised", template_text: `Dear {{full_name}},\n\nYour Reg. 40 grade-review appeal has been completed.\n\n{{coordinator_comment}}\n\nYour transcript will be updated within 1 working week. CGPA will recalculate automatically.\n\nThis is the final outcome under Reg. 40.\n\nYours sincerely,\nExaminations & Graduation Section\nUniversiti Malaya` },
  { procedure_id: "exam_result_appeal", template_type: "rejection", name: "Reg. 40 review — grade unchanged", template_text: `Dear {{full_name}},\n\nYour Reg. 40 grade-review appeal has been completed.\n\n{{coordinator_comment}}\n\nThe original grade stands. The appeal fee is non-refundable. This is the final outcome under Reg. 40.\n\nYours sincerely,\nExaminations & Graduation Section\nUniversiti Malaya` },
];

function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]))];
}

export async function POST() {
  const sb = getServiceSupabase();

  const { data: users, error: usersErr } = await sb
    .from("users")
    .select("id, email")
    .in("email", [DEMO_STUDENT_EMAIL, DEMO_COORD_EMAIL]);
  if (usersErr) return apiError(`Lookup failed: ${usersErr.message}`, 500);

  const studentId = users?.find((u) => u.email === DEMO_STUDENT_EMAIL)?.id;
  const coordId = users?.find((u) => u.email === DEMO_COORD_EMAIL)?.id;
  if (!studentId) return apiError("Demo student not found", 404);
  if (!coordId) return apiError("Demo coordinator not found", 404);

  // ---------- Wipe ----------
  // Wipe ALL applications (not just demo-student's). FKs from
  // application_steps, application_briefings, application_decisions,
  // application_letters, application_messages, application_coordinator_notes
  // all cascade ON DELETE so this single delete clears the whole tree.
  // .neq with a nil-uuid is the supabase-js idiom for "where 1=1" since
  // the client requires a filter.
  const { error: wipeAppErr } = await sb
    .from("applications")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (wipeAppErr) return apiError(`Wipe applications failed: ${wipeAppErr.message}`, 500);

  // Wipe ALL letter templates (they'll be re-upserted) — this catches anything
  // a tester added during exploration.
  await sb.from("procedure_letter_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Wipe non-canonical procedures (admin-created test procedures). The FKs
  // on procedure_sop_chunks and procedure_letter_templates cascade. The FK
  // on applications doesn't, but we already wiped applications above so
  // nothing references these procedures any more. Without this delete,
  // junk procedures like "asfasd" survived every reset.
  await sb
    .from("procedures")
    .delete()
    .not(
      "id",
      "in",
      `(${CANONICAL_PROCEDURE_IDS.map((p) => `"${p}"`).join(",")})`
    );

  // Wipe orphan reasoning traces from previous demo applications.
  await sb.from("glm_reasoning_trace").delete().is("workflow_id", null);

  // ---------- Reseed letter templates ----------
  const templateRows = CANONICAL_TEMPLATES.map((t) => ({
    procedure_id: t.procedure_id,
    template_type: t.template_type,
    name: t.name,
    template_text: t.template_text,
    detected_placeholders: placeholdersIn(t.template_text),
    created_by: coordId,
  }));
  const { error: tplErr } = await sb.from("procedure_letter_templates").insert(templateRows);
  if (tplErr) return apiError(`Template seed failed: ${tplErr.message}`, 500);

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const seeded: { id: string; procedure: string; status: string; label: string }[] = [];
  const insertedAppIds: { scholarship_draft?: string; deferment?: string; fyp?: string } = {};

  // ---------- App 1: scholarship — mid-flow draft ----------
  {
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "scholarship_application", status: "draft",
      progress_estimated_total: 6,
      student_summary: "B40 student, CGPA 3.10, just declared monthly income RM 3,500. Awaiting income proof upload.",
      created_at: hoursAgo(2), updated_at: hoursAgo(0.25),
    }).select("id").single();
    if (app) {
      insertedAppIds.scholarship_draft = app.id;
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "form", prompt_text: "Tell us a bit about your situation.", config: { fields: [{ key: "monthly_income", label: "Monthly family income (RM)", field_type: "number", required: true }, { key: "dependants", label: "Number of dependants", field_type: "number", required: true }] }, emitted_by: "ai", status: "completed", response_data: { monthly_income: "3500", dependants: "4" }, completed_at: hoursAgo(1.5) },
        { application_id: app.id, ordinal: 2, type: "select", prompt_text: "Which scholarship pathway fits you best?", config: { options: [{ value: "yayasan_um", label: "Yayasan UM (B40)" }, { value: "jpa", label: "JPA" }, { value: "mybrainsc", label: "MyBrainSc" }] }, emitted_by: "ai", status: "completed", response_data: { value: "yayasan_um" }, completed_at: hoursAgo(1) },
        { application_id: app.id, ordinal: 3, type: "file_upload", prompt_text: "Please upload your most recent income proof (EPF statement or 3-month payslip).", config: { accepts: ["application/pdf", "image/*"], max_files: 1, citations: ["Document Checklist", "Yayasan UM Pathway"] }, emitted_by: "ai", status: "pending", response_data: null },
      ]);
      seeded.push({ id: app.id, procedure: "scholarship", status: "draft", label: "Mid-flow draft (2 of ~6 steps)" });
    }
  }

  // (Previous App 2 — Scholarship high-conf approve — removed 2026-05-02:
  //  redundant with FYP-submitted (App 6) and Postgrad-submitted (App 8) which
  //  also demonstrate the high-confidence-approve state in the coordinator
  //  inbox, just on different procedures. Cuts the seed from 5 scholarships
  //  to 3, killing the visual-duplicate problem in the student portal.)

  // ---------- App 3: scholarship — submitted, low-conf + block flag ----------
  {
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "scholarship_application", status: "submitted",
      progress_estimated_total: 5,
      student_summary: "Student claims B40 income of RM 2,000 but uploaded EPF shows RM 5,800. Discrepancy needs human review.",
      ai_recommendation: "request_info", ai_confidence: 0.42,
      created_at: hoursAgo(72), submitted_at: hoursAgo(50), updated_at: hoursAgo(50),
    }).select("id").single();
    if (app) {
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "form", prompt_text: "Quick details", config: {}, emitted_by: "ai", status: "completed", response_data: { monthly_income: "2000" }, completed_at: hoursAgo(70) },
        { application_id: app.id, ordinal: 2, type: "file_upload", prompt_text: "Income proof", config: {}, emitted_by: "ai", status: "completed", response_data: { filename: "epf_2024.pdf", size: 220000 }, completed_at: hoursAgo(65) },
        { application_id: app.id, ordinal: 3, type: "final_submit", prompt_text: "Review and submit", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(50) },
      ]);
      await sb.from("application_briefings").insert({
        application_id: app.id,
        extracted_facts: { declared_income_rm: 2000, epf_implied_income_rm: 5800, cgpa: 3.30, income_tier_inferred: "M40" },
        flags: [
          { severity: "block", message: "Declared income (RM 2,000) does not match EPF document (RM 5,800/mo). Possible misreporting or outdated declaration." },
          { severity: "warn", message: "If actual income is M40, student does not qualify for Yayasan UM B40 pathway." },
        ],
        recommendation: "request_info",
        reasoning: "Major discrepancy between self-declared income and the EPF statement. Cannot recommend approval without clarification — likely needs an updated declaration or different income proof.",
        status: "pending",
      });
      seeded.push({ id: app.id, procedure: "scholarship", status: "submitted", label: "Low-confidence (0.42), 1 BLOCK + 1 WARN flag" });
    }
  }

  // ---------- App 4: scholarship — approved + letter ----------
  {
    const { data: tpl } = await sb.from("procedure_letter_templates").select("id").eq("procedure_id", "scholarship_application").eq("template_type", "acceptance").maybeSingle();
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "scholarship_application", status: "approved",
      progress_estimated_total: 5,
      student_summary: "Approved B40 student. Yayasan UM full coverage offered.",
      ai_recommendation: "approve", ai_confidence: 0.88,
      created_at: hoursAgo(168), submitted_at: hoursAgo(72), decided_at: hoursAgo(24), updated_at: hoursAgo(24),
    }).select("id").single();
    if (app) {
      await sb.from("application_steps").insert({ application_id: app.id, ordinal: 1, type: "final_submit", prompt_text: "Reviewed.", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(72) });
      await sb.from("application_decisions").insert({ application_id: app.id, decided_by: coordId, decision: "approve", comment: "Strong candidate. All documents verified.", decided_at: hoursAgo(24) });
      await sb.from("application_letters").insert({
        application_id: app.id, template_id: tpl?.id ?? null, letter_type: "acceptance",
        generated_text: acceptanceLetterText.replace("{{full_name}}", "Aishah binti Razak"),
        delivered_to_student_at: hoursAgo(24),
      });
      seeded.push({ id: app.id, procedure: "scholarship", status: "approved", label: "Decided 24h ago + acceptance letter" });
    }
  }

  // (Previous App 5 — Scholarship rejected+letter — removed 2026-05-02 to
  //  cut the visual-duplicate scholarship cluster. Exam Appeal (App 9) still
  //  demonstrates a non-approve outcome via the more-info-requested status,
  //  and App 4 still shows the "decided + letter" state for scholarship.)

  // ---------- App 6: FYP — submitted, high-confidence ----------
  {
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "final_year_project", status: "submitted",
      progress_estimated_total: 5,
      student_summary: "Year 3 FSKTM student, AD category, supervisor Dr. Aida Ali confirmed. Project: ML-driven patient triage system. Ethics: medium-risk (interviews planned).",
      ai_recommendation: "approve", ai_confidence: 0.86,
      created_at: hoursAgo(36), submitted_at: hoursAgo(8), updated_at: hoursAgo(8),
    }).select("id").single();
    if (app) {
      insertedAppIds.fyp = app.id;
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "select", prompt_text: "Project category", config: {}, emitted_by: "ai", status: "completed", response_data: { value: "app_dev" }, completed_at: hoursAgo(35) },
        { application_id: app.id, ordinal: 2, type: "form", prompt_text: "Supervisor + signed FYP-1 + proposal", config: {}, emitted_by: "ai", status: "completed", response_data: { supervisor_name: "Dr. Aida Ali", project_title: "ML-driven patient triage system", proposal: { filename: "fyp_proposal.pdf", size: 412000 }, signed_form: { filename: "fyp_1_signed.pdf", size: 88000 } }, completed_at: hoursAgo(28) },
        { application_id: app.id, ordinal: 3, type: "select", prompt_text: "Ethics tier", config: {}, emitted_by: "ai", status: "completed", response_data: { value: "medium_risk" }, completed_at: hoursAgo(20) },
        { application_id: app.id, ordinal: 4, type: "final_submit", prompt_text: "Review", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(8) },
      ]);
      await sb.from("application_briefings").insert({
        application_id: app.id,
        extracted_facts: { category: "Application Development", supervisor: "Dr. Aida Ali", title: "ML-driven patient triage system", ethics_tier: "medium_risk" },
        flags: [
          { severity: "info", message: "Supervisor capacity verified — Dr. Aida Ali at 3/5 FYP students, accepting." },
          { severity: "warn", message: "Medium-risk ethics review — student should submit Ethics Declaration form within 4 weeks (standard 4-week turnaround)." },
        ],
        recommendation: "approve",
        reasoning: "All documents present, supervisor confirmed, project scope is clear and realistic for AD category. Ethics tier acknowledged — coordinator should remind student of the 4-week submission deadline.",
        status: "pending",
      });
      seeded.push({ id: app.id, procedure: "final_year_project", status: "submitted", label: "FYP I, AD category, high-conf approve" });
    }
  }

  // ---------- App 7: Deferment — approved with letter ----------
  {
    const { data: tpl } = await sb.from("procedure_letter_templates").select("id").eq("procedure_id", "deferment_of_studies").eq("template_type", "acceptance").maybeSingle();
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "deferment_of_studies", status: "approved",
      progress_estimated_total: 4,
      student_summary: "Year 2 student, medical deferment (1 academic year). MC from UMMC verified. Return semester: 1, 2026/2027.",
      ai_recommendation: "approve", ai_confidence: 0.94,
      created_at: hoursAgo(720), submitted_at: hoursAgo(168), decided_at: hoursAgo(120), updated_at: hoursAgo(120),
    }).select("id").single();
    if (app) {
      insertedAppIds.deferment = app.id;
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "select", prompt_text: "Reason for deferment", config: {}, emitted_by: "ai", status: "completed", response_data: { value: "medical" }, completed_at: hoursAgo(700) },
        { application_id: app.id, ordinal: 2, type: "form", prompt_text: "Documents", config: {}, emitted_by: "ai", status: "completed", response_data: { mc: { filename: "ummc_mc.pdf", size: 156000 }, personal_statement: { filename: "personal_statement.pdf", size: 44000 }, return_semester: "Semester 1, 2026/2027" }, completed_at: hoursAgo(680) },
        { application_id: app.id, ordinal: 3, type: "final_submit", prompt_text: "Submit", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(168) },
      ]);
      await sb.from("application_decisions").insert({ application_id: app.id, decided_by: coordId, decision: "approve", comment: "Medical documentation from UMMC is comprehensive. Return semester recorded.", decided_at: hoursAgo(120) });
      await sb.from("application_letters").insert({
        application_id: app.id, template_id: tpl?.id ?? null, letter_type: "acceptance",
        generated_text: defermentApprovedText.replace("{{full_name}}", "Tan Wei Ming"),
        delivered_to_student_at: hoursAgo(120),
      });
      seeded.push({ id: app.id, procedure: "deferment_of_studies", status: "approved", label: "Medical deferment, approved + letter" });
    }
  }

  // ---------- App 8: Postgrad — submitted, high-conf ----------
  {
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "postgrad_admission", status: "submitted",
      progress_estimated_total: 6,
      student_summary: "Master's by research (FCSIT). Supervisor matched (Dr. Lee). UG CGPA 3.78. Research proposal: distributed AI inference. International student — visa coordination noted.",
      ai_recommendation: "approve", ai_confidence: 0.81,
      created_at: hoursAgo(96), submitted_at: hoursAgo(40), updated_at: hoursAgo(40),
    }).select("id").single();
    if (app) {
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "form", prompt_text: "Programme + supervisor", config: {}, emitted_by: "ai", status: "completed", response_data: { programme: "Master's by Research", supervisor: "Dr. Lee Mei Sze" }, completed_at: hoursAgo(95) },
        { application_id: app.id, ordinal: 2, type: "file_upload", prompt_text: "Transcript", config: {}, emitted_by: "ai", status: "completed", response_data: { filename: "ug_transcript.pdf", size: 312000 }, completed_at: hoursAgo(80) },
        { application_id: app.id, ordinal: 3, type: "file_upload", prompt_text: "Research proposal", config: {}, emitted_by: "ai", status: "completed", response_data: { filename: "research_proposal.pdf", size: 488000 }, completed_at: hoursAgo(60) },
        { application_id: app.id, ordinal: 4, type: "final_submit", prompt_text: "Submit", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(40) },
      ]);
      await sb.from("application_briefings").insert({
        application_id: app.id,
        extracted_facts: { ug_cgpa: 3.78, programme: "MRes", supervisor: "Dr. Lee Mei Sze", citizenship: "INTL", research_area: "distributed AI inference" },
        flags: [
          { severity: "info", message: "Supervisor matched and accepted — proposal aligns with Dr. Lee's published research." },
          { severity: "info", message: "International student — needs to coordinate EMGS visa application after IPS offer letter is issued." },
        ],
        recommendation: "approve",
        reasoning: "Strong UG CGPA (3.78), supervisor matched proactively, research proposal is well-scoped. Recommend offer with standard visa-coordination note for international students.",
        status: "pending",
      });
      seeded.push({ id: app.id, procedure: "postgrad_admission", status: "submitted", label: "MRes intl, supervisor-matched, high-conf" });
    }
  }

  // ---------- App 9: Exam Appeal — more_info_requested ----------
  {
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "exam_result_appeal", status: "more_info_requested",
      progress_estimated_total: 4,
      student_summary: "Year 4 student appealing WIA3007 final exam grade (B → A). Cited Q3 marking. Did not include payment proof yet.",
      ai_recommendation: "request_info", ai_confidence: 0.55,
      created_at: hoursAgo(120), submitted_at: hoursAgo(48), updated_at: hoursAgo(6),
    }).select("id").single();
    if (app) {
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "form", prompt_text: "Course + complaint", config: {}, emitted_by: "ai", status: "completed", response_data: { course: "WIA3007 Software Engineering", original_grade: "B", complaint: "Q3 should have given 8 marks not 4 — my answer matches the rubric exactly per the answer scheme released on MAYA." }, completed_at: hoursAgo(110) },
        { application_id: app.id, ordinal: 2, type: "final_submit", prompt_text: "Submit", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(48) },
        { application_id: app.id, ordinal: 3, type: "file_upload", prompt_text: "Coordinator request: please upload your RM 50 appeal-fee payment proof from MAYA. Without payment, the appeal cannot be processed under Reg. 40.", config: { accepts: ["application/pdf", "image/*"], citations: ["Documents Required", "Common Pitfalls"] }, emitted_by: "coordinator", status: "pending", response_data: null },
      ]);
      await sb.from("application_briefings").insert({
        application_id: app.id,
        extracted_facts: { course: "WIA3007", current_grade: "B", desired_grade: "A", complaint_specificity: "specific (Q3 marking)" },
        flags: [
          { severity: "block", message: "No payment proof attached. Reg. 40 explicitly requires RM 50 fee per course paid before submission." },
          { severity: "info", message: "Complaint is specific (Q3 marking against answer scheme) — within Reg. 40 acceptable concerns." },
        ],
        recommendation: "request_info",
        reasoning: "The complaint itself is well-formed and within Reg. 40 acceptable concerns. However, payment proof is missing — without it the appeal cannot be processed. Coordinator should request the payment proof before re-evaluating.",
        status: "resolved",
      });
      await sb.from("application_decisions").insert({
        application_id: app.id, decided_by: coordId, decision: "request_info",
        comment: "Please upload your RM 50 appeal-fee payment proof from MAYA. Without payment, the appeal cannot be processed under Reg. 40.",
        decided_at: hoursAgo(6),
      });
      seeded.push({ id: app.id, procedure: "exam_result_appeal", status: "more_info_requested", label: "Reg. 40 appeal, awaiting payment proof" });
    }
  }

  // ---------- App 10: FYP — near-complete draft (upload + submit demo) ----------
  // For the live demo: a student app where the next 2 steps are just "upload
  // your file" then "submit". Lets the demo walk the full happy-path completion
  // (upload → AI emits final_submit → student submits → coordinator inbox)
  // in <1 minute. Steps 1-2 are pre-completed; only the file_upload is
  // pending — the engine will emit the final_submit step naturally after
  // the student responds to step 3.
  {
    const { data: app } = await sb.from("applications").insert({
      user_id: studentId, procedure_id: "final_year_project", status: "draft",
      progress_estimated_total: 4,
      student_summary: "FYP I — AD category, supervisor confirmed, proposal submitted. Awaiting signed FYP-1 form upload, then final submit.",
      created_at: hoursAgo(6), updated_at: hoursAgo(0.3),
    }).select("id").single();
    if (app) {
      await sb.from("application_steps").insert([
        {
          application_id: app.id, ordinal: 1, type: "select",
          prompt_text: "Which FYP category fits your project?",
          config: { options: [
            { value: "app_dev", label: "Application Development (AD)" },
            { value: "research", label: "Research" },
            { value: "industry", label: "Industry-linked" },
          ] },
          emitted_by: "ai", status: "completed",
          response_data: { value: "app_dev" },
          completed_at: hoursAgo(5.5),
        },
        {
          application_id: app.id, ordinal: 2, type: "form",
          prompt_text: "Tell us about your supervisor and project.",
          config: { fields: [
            { key: "supervisor_name", label: "Supervisor name", field_type: "text", required: true },
            { key: "project_title",  label: "Project title",   field_type: "text", required: true },
          ] },
          emitted_by: "ai", status: "completed",
          response_data: {
            supervisor_name: "Dr. Chen Wei Liang",
            project_title: "Recommendation system for the UM library digital catalogue",
          },
          completed_at: hoursAgo(5),
        },
        {
          application_id: app.id, ordinal: 3, type: "file_upload",
          prompt_text: "Please upload your signed FYP-1 form (supervisor + student signatures).",
          config: {
            accepts: ["application/pdf"],
            max_files: 1,
            citations: ["Documents Required", "Process Steps"],
          },
          emitted_by: "ai", status: "pending", response_data: null,
        },
      ]);
      seeded.push({
        id: app.id,
        procedure: "final_year_project",
        status: "draft",
        label: "Near-complete: upload signed FYP-1 then submit (2 of 4 done)",
      });
    }
  }

  // ---------- Sample messages on the FYP submitted app ----------
  if (insertedAppIds.fyp) {
    await sb.from("application_messages").insert([
      { application_id: insertedAppIds.fyp, author_id: studentId, author_role: "student", body: "Hi! Is there a specific format for the ethics declaration form, or do I just write a paragraph?", created_at: hoursAgo(7) },
      { application_id: insertedAppIds.fyp, author_id: coordId, author_role: "coordinator", body: "Use the Faculty Ethics Committee template (FEC/02 form), available on the FSKTM intranet. One paragraph isn't enough — they want the structured form with risk-tier checkboxes.", created_at: hoursAgo(6) },
      { application_id: insertedAppIds.fyp, author_id: studentId, author_role: "student", body: "Thanks! Will submit it within the week.", created_at: hoursAgo(5.5) },
    ]);
  }

  // (Previous internal-note seed targeted insertedAppIds.scholarship_high which
  //  belonged to the now-removed App 2 — internal-notes UX still demonstrable
  //  on any submitted app via the coordinator detail page; not worth re-seeding
  //  on a different row.)

  return apiSuccess({
    reset: true,
    seeded_applications: seeded.length,
    seeded_templates: templateRows.length,
    seeded,
  });
}
