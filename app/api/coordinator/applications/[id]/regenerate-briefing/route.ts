/**
 * POST /api/coordinator/applications/[id]/regenerate-briefing
 *
 * Re-runs generateBriefing for an already-submitted application. Used when
 * the briefing the student got at submit-time is the fallback (Z.AI was
 * slow / down at submission), and a coordinator wants the real AI briefing
 * now. Inserts a NEW briefing row (the schema allows multiple per
 * application) and updates the applications row's ai_recommendation +
 * ai_confidence so the inbox view picks up the fresh recommendation.
 *
 * Auth: staff/admin only.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { generateBriefing } from "@/lib/glm/generateBriefing";
import { buildHistory, loadApplicationContext } from "@/lib/applications/engine";
import { retrieveProcedureSop } from "@/lib/kb/retrieve";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
// One generateBriefing GLM call. Z.AI under load can hit the 60 s ceiling
// but on glm-4.5-flash this is usually well under that.
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (app.status === "draft") {
    return apiError(
      "Application is still in draft — a briefing can only be generated after the student submits.",
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

  let briefing;
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
    return apiError(
      `AI briefing generation failed: ${err instanceof Error ? err.message : "unknown"}. Z.AI may be slow — try again in a moment.`,
      503
    );
  }

  // Surface any open escalation as an info-severity flag on the new briefing
  // (mirrors the submit-time logic).
  const flags = escalationRow.data?.body
    ? [
        ...briefing.flags,
        {
          severity: "info" as const,
          message: `Student raised an escalation during this application: ${escalationRow.data.body.slice(0, 400)}${escalationRow.data.body.length > 400 ? "…" : ""}`,
        },
      ]
    : briefing.flags;

  const { data: insertedBriefing, error: insErr } = await sb
    .from("application_briefings")
    .insert({
      application_id: applicationId,
      extracted_facts: briefing.extracted_facts,
      flags,
      recommendation: briefing.recommendation,
      reasoning: briefing.reasoning,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !insertedBriefing) {
    return apiError(`Failed to write briefing: ${insErr?.message}`, 500);
  }

  // Refresh the inbox-facing fields on the applications row.
  await sb
    .from("applications")
    .update({
      ai_recommendation: briefing.recommendation,
      ai_confidence: briefing.ai_confidence,
    })
    .eq("id", applicationId);

  return apiSuccess({
    regenerated: true,
    briefing_id: insertedBriefing.id,
    recommendation: briefing.recommendation,
    ai_confidence: briefing.ai_confidence,
  });
}
