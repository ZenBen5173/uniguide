/**
 * POST /api/coordinator/applications/[id]/preview-step
 *
 * Body: { comment: string }
 *
 * Mirrors /preview-letter for the Request-More-Info flow: runs the AI's
 * next-step planning with the coordinator's comment as the trigger, but
 * does NOT insert the resulting step. The coordinator sees the proposal
 * in a modal and can confirm (with optional edits) before it commits.
 *
 * The actual commit happens via /decide with `decision: "request_info"`
 * + `step_override: { type, prompt_text, config }`.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { previewNextStep } from "@/lib/applications/engine";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  comment: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  // Sanity: application must exist + be in a state that accepts a request_info.
  const sb = getServiceSupabase();
  const { data: app } = await sb
    .from("applications")
    .select("id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (!["submitted", "more_info_requested", "under_review"].includes(app.status)) {
    return apiError(`Application is ${app.status} — cannot request more info`, 409);
  }

  let proposed;
  try {
    proposed = await previewNextStep({
      applicationId,
      coordinatorRequest: parsed.data.comment,
    });
  } catch (err) {
    return apiError(
      `Could not plan a next step: ${err instanceof Error ? err.message : "unknown"}`,
      500
    );
  }

  if (!proposed) {
    return apiError(
      "AI signalled this application is already complete — nothing to ask.",
      409,
      { is_complete: true }
    );
  }

  return apiSuccess({
    proposed_step: {
      type: proposed.type,
      prompt_text: proposed.prompt_text,
      config: proposed.config,
    },
    reasoning: proposed.reasoning,
    citations: proposed.citations,
  });
}
