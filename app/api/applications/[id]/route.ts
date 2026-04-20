/**
 * GET /api/applications/[id]
 * Returns the full application: meta, all steps (in order), latest letter, decision.
 * Owner OR staff can read.
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("id, user_id, procedure_id, status, progress_current_step, progress_estimated_total, student_summary, ai_recommendation, ai_confidence, created_at, submitted_at, decided_at, procedures(name, description, deadline_date, deadline_label)")
    .eq("id", id)
    .single();
  if (!app) return apiError("Application not found", 404);

  const isOwner = app.user_id === user.id;
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isOwner && !isStaff) return apiError("Forbidden", 403);

  const [{ data: steps }, { data: letters }] = await Promise.all([
    sb.from("application_steps")
      .select("id, ordinal, type, prompt_text, config, emitted_by, status, response_data, created_at, completed_at")
      .eq("application_id", id)
      .order("ordinal"),
    sb.from("application_letters")
      .select("id, letter_type, generated_text, delivered_to_student_at, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return apiSuccess({
    application: app,
    steps: steps ?? [],
    letters: letters ?? [],
  });
}
