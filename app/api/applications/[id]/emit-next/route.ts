/**
 * POST /api/applications/[id]/emit-next
 *
 * Recovery endpoint for stuck-draft applications. Used by the student's
 * smart-application UI when the previous /respond returned `stuck: true`
 * (i.e. the response was saved but the AI's next-step planning failed
 * or timed out). Hitting this endpoint re-fires emitNextStep so the
 * application can resume its flow.
 *
 * Idempotent: if the application already has a pending step, we return it
 * untouched rather than emitting a duplicate.
 *
 * Auth: must be the application's owner. Drafts only — submitted apps
 * advance through other paths.
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { emitNextStep } from "@/lib/applications/engine";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
// One nextStep GLM call. Z.AI under load can take 60s — same ceiling as
// the routes that originally called it.
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
    return apiError(`Application is ${app.status} — recovery only applies to drafts`, 409);
  }

  // If there's already a pending step, the application isn't actually stuck —
  // return that step instead of emitting a duplicate.
  const { data: pendingStep } = await sb
    .from("application_steps")
    .select("id, ordinal, type, prompt_text, config")
    .eq("application_id", applicationId)
    .eq("status", "pending")
    .order("ordinal", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendingStep) {
    return apiSuccess({
      already_pending: true,
      next_step: pendingStep,
    });
  }

  try {
    const result = await emitNextStep({ applicationId });
    return apiSuccess({
      already_pending: false,
      is_complete: result.complete,
      next_step: result.complete ? null : result.step,
    });
  } catch (err) {
    return apiError(
      `Recovery failed: ${err instanceof Error ? err.message : "unknown"}`,
      500
    );
  }
}
