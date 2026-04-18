/**
 * POST /api/applications/[id]/submit
 *
 * Finalises the application:
 *  - Generates the coordinator briefing
 *  - Writes the briefing to application_briefings
 *  - Flips application status to 'submitted'
 *  - Updates ai_recommendation + ai_confidence on the application row (for inbox)
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { generateBriefing } from "@/lib/glm/generateBriefing";
import { buildHistory, loadApplicationContext } from "@/lib/applications/engine";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("user_id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (app.user_id !== user.id) return apiError("Forbidden", 403);
  if (app.status !== "draft" && app.status !== "more_info_requested") {
    return apiError(`Application is ${app.status} — cannot submit`, 409);
  }

  const appCtx = await loadApplicationContext(applicationId);
  if (!appCtx) return apiError("Application context missing", 500);

  const history = await buildHistory(applicationId);

  let briefing;
  try {
    briefing = await generateBriefing(
      {
        procedureName: appCtx.procedure.name,
        studentProfile: appCtx.studentProfile,
        history,
      },
      { applicationId }
    );
  } catch (err) {
    return apiError(`Briefing generation failed: ${err instanceof Error ? err.message : "unknown"}`, 502);
  }

  const { data: insertedBriefing, error: insErr } = await sb
    .from("application_briefings")
    .insert({
      application_id: applicationId,
      extracted_facts: briefing.extracted_facts,
      flags: briefing.flags,
      recommendation: briefing.recommendation,
      reasoning: briefing.reasoning,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !insertedBriefing) {
    return apiError(`Failed to write briefing: ${insErr?.message}`, 500);
  }

  await sb
    .from("applications")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ai_recommendation: briefing.recommendation,
      ai_confidence: briefing.ai_confidence,
    })
    .eq("id", applicationId);

  return apiSuccess({
    submitted: true,
    briefing_id: insertedBriefing.id,
    recommendation: briefing.recommendation,
  });
}
