/**
 * POST /api/demo/reset
 *
 * Wipes the Demo Student's applications, then seeds a fresh set of sample
 * applications in varied states so the coordinator inbox + analytics +
 * GLM traces all have something interesting to look at:
 *
 *  1. A draft mid-flow (2 steps complete, 1 pending) — student can resume
 *  2. A submitted high-confidence "approve" candidate
 *  3. A submitted low-confidence + flagged candidate (review carefully)
 *  4. An already-approved with letter
 *  5. An already-rejected with letter
 *
 * Anyone can call this — only touches the demo accounts.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const DEMO_STUDENT_EMAIL = "demo-student@uniguide.local";
const DEMO_COORD_EMAIL = "demo-coordinator@uniguide.local";
const PROCEDURE_ID = "scholarship_application";

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

export async function POST() {
  const sb = getServiceSupabase();

  const { data: users, error: usersErr } = await sb
    .from("users")
    .select("id, email")
    .in("email", [DEMO_STUDENT_EMAIL, DEMO_COORD_EMAIL]);
  if (usersErr) return apiError(`Lookup failed: ${usersErr.message}`, 500);

  const studentId = users?.find((u) => u.email === DEMO_STUDENT_EMAIL)?.id;
  const coordId = users?.find((u) => u.email === DEMO_COORD_EMAIL)?.id ?? null;
  if (!studentId) return apiError("Demo student not found", 404);

  // Verify procedure exists with chunks (we won't seed if SOP isn't ready).
  const { data: procedure } = await sb.from("procedures").select("id").eq("id", PROCEDURE_ID).maybeSingle();
  if (!procedure) return apiError(`Procedure ${PROCEDURE_ID} not found — seed it first`, 412);

  // Wipe existing apps (cascades to steps/briefings/decisions/letters).
  const { error: wipeErr } = await sb.from("applications").delete().eq("user_id", studentId);
  if (wipeErr) return apiError(`Wipe failed: ${wipeErr.message}`, 500);

  // Wipe orphan reasoning traces.
  await sb.from("glm_reasoning_trace").delete().is("workflow_id", null);

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const seedReport: { id: string; status: string; label: string }[] = [];

  // ---------- App 1: draft, mid-flow ----------
  {
    const { data: app } = await sb
      .from("applications")
      .insert({
        user_id: studentId,
        procedure_id: PROCEDURE_ID,
        status: "draft",
        progress_estimated_total: 6,
        student_summary: "B40 student, CGPA 3.10, just declared monthly income RM 3,500. Awaiting income proof upload.",
        created_at: hoursAgo(2),
        updated_at: hoursAgo(0.25),
      })
      .select("id")
      .single();
    if (app) {
      await sb.from("application_steps").insert([
        {
          application_id: app.id,
          ordinal: 1,
          type: "form",
          prompt_text: "Tell us a bit about your situation.",
          config: { fields: [{ key: "monthly_income", label: "Monthly family income (RM)", field_type: "number", required: true }, { key: "dependants", label: "Number of dependants", field_type: "number", required: true }] },
          emitted_by: "ai",
          status: "completed",
          response_data: { monthly_income: "3500", dependants: "4" },
          completed_at: hoursAgo(1.5),
        },
        {
          application_id: app.id,
          ordinal: 2,
          type: "select",
          prompt_text: "Which scholarship pathway fits you best?",
          config: { options: [{ value: "yayasan_um", label: "Yayasan UM (B40)" }, { value: "jpa", label: "JPA" }, { value: "mybrainsc", label: "MyBrainSc" }] },
          emitted_by: "ai",
          status: "completed",
          response_data: { value: "yayasan_um" },
          completed_at: hoursAgo(1),
        },
        {
          application_id: app.id,
          ordinal: 3,
          type: "file_upload",
          prompt_text: "Please upload your most recent income proof (EPF statement or 3-month payslip).",
          config: { accepts: ["application/pdf", "image/*"], max_files: 1, citations: ["Document Checklist", "Yayasan UM Pathway"] },
          emitted_by: "ai",
          status: "pending",
          response_data: null,
        },
      ]);
      seedReport.push({ id: app.id, status: "draft", label: "Mid-flow draft (2 of ~6 steps complete)" });
    }
  }

  // ---------- App 2: submitted, high-confidence approve ----------
  {
    const { data: app } = await sb
      .from("applications")
      .insert({
        user_id: studentId,
        procedure_id: PROCEDURE_ID,
        status: "submitted",
        progress_estimated_total: 5,
        student_summary: "B40 student, CGPA 3.45, household income RM 2,800 (verified via EPF). Eligible for full Yayasan UM coverage.",
        ai_recommendation: "approve",
        ai_confidence: 0.92,
        created_at: hoursAgo(48),
        submitted_at: hoursAgo(20),
        updated_at: hoursAgo(20),
      })
      .select("id")
      .single();
    if (app) {
      await sb.from("application_steps").insert([
        { application_id: app.id, ordinal: 1, type: "form", prompt_text: "Quick details", config: {}, emitted_by: "ai", status: "completed", response_data: { monthly_income: "2800" }, completed_at: hoursAgo(47) },
        { application_id: app.id, ordinal: 2, type: "file_upload", prompt_text: "Income proof", config: {}, emitted_by: "ai", status: "completed", response_data: { filename: "epf_statement.pdf", size: 184000 }, completed_at: hoursAgo(45) },
        { application_id: app.id, ordinal: 3, type: "text", prompt_text: "Why this scholarship?", config: { max_length: 1000 }, emitted_by: "ai", status: "completed", response_data: { text: "I am the eldest of four children. My father drives an e-hailing car part-time and my mother is a homemaker. This scholarship would let me focus on my SE coursework instead of taking on more part-time work." }, completed_at: hoursAgo(44) },
        { application_id: app.id, ordinal: 4, type: "final_submit", prompt_text: "Review and submit", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(20) },
      ]);
      await sb.from("application_briefings").insert({
        application_id: app.id,
        extracted_facts: { household_income_rm: 2800, income_tier: "B40", cgpa: 3.45, dependants: 4 },
        flags: [{ severity: "info", message: "All required documents present and verified." }],
        recommendation: "approve",
        reasoning: "Strong B40 candidate with CGPA above the 3.30 threshold. Income proof verified, motivation letter is specific and grounded. No red flags.",
        status: "pending",
      });
      seedReport.push({ id: app.id, status: "submitted", label: "High-confidence approve (0.92)" });
    }
  }

  // ---------- App 3: submitted, low-confidence + block flag ----------
  {
    const { data: app } = await sb
      .from("applications")
      .insert({
        user_id: studentId,
        procedure_id: PROCEDURE_ID,
        status: "submitted",
        progress_estimated_total: 5,
        student_summary: "Student claims B40 income of RM 2,000 but uploaded EPF shows RM 5,800. Discrepancy needs human review.",
        ai_recommendation: "request_info",
        ai_confidence: 0.42,
        created_at: hoursAgo(72),
        submitted_at: hoursAgo(50),
        updated_at: hoursAgo(50),
      })
      .select("id")
      .single();
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
      seedReport.push({ id: app.id, status: "submitted", label: "Low-confidence (0.42), 1 BLOCK + 1 WARN flag" });
    }
  }

  // ---------- App 4: already approved + letter ----------
  if (coordId) {
    const { data: app } = await sb
      .from("applications")
      .insert({
        user_id: studentId,
        procedure_id: PROCEDURE_ID,
        status: "approved",
        progress_estimated_total: 5,
        student_summary: "Approved B40 student. Yayasan UM full coverage offered.",
        ai_recommendation: "approve",
        ai_confidence: 0.88,
        created_at: hoursAgo(168),
        submitted_at: hoursAgo(72),
        decided_at: hoursAgo(24),
        updated_at: hoursAgo(24),
      })
      .select("id")
      .single();
    if (app) {
      await sb.from("application_steps").insert({
        application_id: app.id, ordinal: 1, type: "final_submit", prompt_text: "Reviewed.", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(72),
      });
      await sb.from("application_decisions").insert({
        application_id: app.id, decided_by: coordId, decision: "approve", comment: "Strong candidate. All documents verified.", decided_at: hoursAgo(24),
      });
      await sb.from("application_letters").insert({
        application_id: app.id, letter_type: "acceptance", generated_text: acceptanceLetterText, delivered_to_student_at: hoursAgo(24),
      });
      seedReport.push({ id: app.id, status: "approved", label: "Decided 24h ago + acceptance letter" });
    }
  }

  // ---------- App 5: already rejected + letter ----------
  if (coordId) {
    const { data: app } = await sb
      .from("applications")
      .insert({
        user_id: studentId,
        procedure_id: PROCEDURE_ID,
        status: "rejected",
        progress_estimated_total: 5,
        student_summary: "CGPA below threshold (3.05).",
        ai_recommendation: "reject",
        ai_confidence: 0.78,
        created_at: hoursAgo(336),
        submitted_at: hoursAgo(96),
        decided_at: hoursAgo(48),
        updated_at: hoursAgo(48),
      })
      .select("id")
      .single();
    if (app) {
      await sb.from("application_steps").insert({
        application_id: app.id, ordinal: 1, type: "final_submit", prompt_text: "Reviewed.", config: {}, emitted_by: "ai", status: "completed", response_data: { confirmed: true }, completed_at: hoursAgo(96),
      });
      await sb.from("application_decisions").insert({
        application_id: app.id, decided_by: coordId, decision: "reject", comment: "CGPA below 3.30 threshold.", decided_at: hoursAgo(48),
      });
      await sb.from("application_letters").insert({
        application_id: app.id, letter_type: "rejection", generated_text: rejectionLetterText, delivered_to_student_at: hoursAgo(48),
      });
      seedReport.push({ id: app.id, status: "rejected", label: "Decided 48h ago + rejection letter" });
    }
  }

  return apiSuccess({ reset: true, seeded: seedReport });
}
