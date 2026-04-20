/**
 * GET /api/coordinator/applications/[id]
 * Full application detail for the coordinator: briefing + steps + decisions + letters.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select(`
      id, user_id, procedure_id, status, ai_recommendation, ai_confidence,
      student_summary, submitted_at, decided_at, created_at, updated_at,
      assigned_to, assigned_at,
      procedures(name, description)
    `)
    .eq("id", id)
    .single();
  if (!app) return apiError("Application not found", 404);

  // Student profile lookup (no direct FK between applications and student_profiles)
  const { data: studentProfile } = await sb
    .from("student_profiles")
    .select("full_name, faculty, programme, year, cgpa, citizenship, matric_no")
    .eq("user_id", app.user_id)
    .maybeSingle();
  (app as Record<string, unknown>).student_profiles = studentProfile ?? null;

  let assignee_name: string | null = null;
  if (app.assigned_to) {
    const { data: assigneeProfile } = await sb
      .from("staff_profiles")
      .select("full_name")
      .eq("user_id", app.assigned_to)
      .maybeSingle();
    assignee_name = assigneeProfile?.full_name ?? "Coordinator";
  }

  const [{ data: briefing }, { data: steps }, { data: decisions }, { data: letters }] = await Promise.all([
    sb.from("application_briefings")
      .select("id, extracted_facts, flags, recommendation, reasoning, status, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("application_steps")
      .select("id, ordinal, type, prompt_text, config, emitted_by, status, response_data, created_at, completed_at")
      .eq("application_id", id)
      .order("ordinal"),
    sb.from("application_decisions")
      .select("id, decision, comment, decided_by, decided_at")
      .eq("application_id", id)
      .order("decided_at", { ascending: false }),
    sb.from("application_letters")
      .select("id, letter_type, generated_text, delivered_to_student_at, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return apiSuccess({
    application: { ...app, assignee_name },
    briefing,
    steps: steps ?? [],
    decisions: decisions ?? [],
    letters: letters ?? [],
    viewer: { id: user.id },
  });
}
