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

export const runtime = "nodejs";
// Briefing generation is a single GLM call but Z.AI latency under load
// has been observed at 30-60s. Default Vercel timeout (10s Hobby / 15s Pro)
// would kill it mid-call.
export const maxDuration = 60;

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

  // Guard: only accept /submit when the AI has actually emitted a
  // final_submit step and the student has completed every prior step.
  // Earlier this route allowed direct /submit on an empty history,
  // which produced briefings with no facts and confused the inbox.
  const { data: incompleteSteps } = await sb
    .from("application_steps")
    .select("id, type, status")
    .eq("application_id", applicationId)
    .neq("status", "completed");
  const hasPendingNonFinal = (incompleteSteps ?? []).some((s) => s.type !== "final_submit");
  if (hasPendingNonFinal) {
    return apiError(
      "Please complete the remaining steps before submitting your application.",
      409
    );
  }

  const appCtx = await loadApplicationContext(applicationId);
  if (!appCtx) return apiError("Application context missing", 500);

  const [history, sopChunks, escalationRow] = await Promise.all([
    buildHistory(applicationId),
    retrieveProcedureSop(appCtx.procedure.id),
    sb.from("application_messages")
      .select("body, created_at")
      .eq("application_id", applicationId)
      .eq("kind", "escalation_summary")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  // The DB CHECK constraint on application_briefings.recommendation only
  // allows {approve, reject, request_info}. Earlier this fallback used
  // 'review', which made the insert below throw — turning the "resilient
  // fallback" into a guaranteed failure. We use 'request_info' instead:
  // it accurately signals "coordinator action required" and is one of the
  // three valid values.
  const fallback = {
    extracted_facts: {},
    flags: [{
      severity: "warn" as const,
      message: "AI briefing failed to generate — coordinator should regenerate or review the raw history.",
    }],
    recommendation: "request_info" as const,
    reasoning: "Automatic briefing was unavailable at submission time. Please review the application history directly and request additional info from the student if needed.",
    ai_confidence: 0.0,
  };
  const finalBriefing = briefing ?? fallback;

  // If the student raised an escalation during the application, surface it
  // as an info-severity flag so the coordinator reviewing this submission
  // sees the prior question in context. Doesn't block — just adds context.
  if (escalationRow.data?.body) {
    finalBriefing.flags = [
      ...finalBriefing.flags,
      {
        severity: "info" as const,
        message: `Student raised an escalation during this application: ${escalationRow.data.body.slice(0, 400)}${escalationRow.data.body.length > 400 ? "…" : ""}`,
      },
    ];
  }

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

  // The briefing row is already written; if the status update fails the
  // application is in a half-submitted state (briefing exists, status still
  // 'draft'). Surface the error so the client can retry rather than reporting
  // success on a half-completed submit.
  const { error: appUpdErr } = await sb
    .from("applications")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      ai_recommendation: finalBriefing.recommendation,
      ai_confidence: finalBriefing.ai_confidence,
    })
    .eq("id", applicationId);
  if (appUpdErr) {
    return apiError(
      `Briefing saved but failed to flip application to 'submitted': ${appUpdErr.message}. Please retry.`,
      500
    );
  }

  return apiSuccess({
    submitted: true,
    briefing_id: insertedBriefing.id,
    recommendation: finalBriefing.recommendation,
    briefing_fallback: briefing === null,
  });
}
