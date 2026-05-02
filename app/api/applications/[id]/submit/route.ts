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
import { retrieveProcedureSop } from "@/lib/kb/retrieve";
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

  const [history, sopChunks] = await Promise.all([
    buildHistory(applicationId),
    retrieveProcedureSop(appCtx.procedure.id),
  ]);

  // Generate the briefing. If GLM fails (rate-limit, transient 5xx, key
  // expired), we DON'T abandon the submission — that would leave the student
  // with a half-submitted application and no clear recovery path. Instead we
  // write a safe-fallback briefing flagged for coordinator regeneration, and
  // still flip status to 'submitted'. The application appears in the inbox
  // with recommendation=review so a coordinator can act on it.
  let briefing: Awaited<ReturnType<typeof generateBriefing>> | null = null;
  try {
    briefing = await generateBriefing(
      {
        procedureName: appCtx.procedure.name,
        studentProfile: appCtx.studentProfile,
        history,
        sopChunks,
      },
      { applicationId }
    );
  } catch (err) {
    console.error("[submit] briefing generation failed — falling back:", err);
  }

  const fallback = {
    extracted_facts: {},
    flags: [{
      severity: "warn" as const,
      message: "AI briefing failed to generate — coordinator should regenerate or review the raw history.",
    }],
    recommendation: "review" as const,
    reasoning: "Automatic briefing was unavailable at submission time. Please review the application history directly.",
    ai_confidence: 0.0,
  };
  const finalBriefing = briefing ?? fallback;

  const { data: insertedBriefing, error: insErr } = await sb
    .from("application_briefings")
    .insert({
      application_id: applicationId,
      extracted_facts: finalBriefing.extracted_facts,
      flags: finalBriefing.flags,
      recommendation: finalBriefing.recommendation,
      reasoning: finalBriefing.reasoning,
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
      ai_recommendation: finalBriefing.recommendation,
      ai_confidence: finalBriefing.ai_confidence,
    })
    .eq("id", applicationId);

  return apiSuccess({
    submitted: true,
    briefing_id: insertedBriefing.id,
    recommendation: finalBriefing.recommendation,
    briefing_fallback: briefing === null,
  });
}
