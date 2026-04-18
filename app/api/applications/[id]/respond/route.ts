/**
 * POST /api/applications/[id]/respond
 *
 * Body: { step_id, response_data }
 * Records the student's response to the current pending step,
 * then triggers nextStep to emit the following step.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { recordResponseAndAdvance } from "@/lib/applications/engine";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  step_id: z.string().uuid(),
  response_data: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id: applicationId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const sb = getServiceSupabase();

  // Verify ownership.
  const { data: app } = await sb
    .from("applications")
    .select("user_id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (app.user_id !== user.id) return apiError("Forbidden", 403);
  if (["approved", "rejected", "withdrawn"].includes(app.status)) {
    return apiError(`Application is ${app.status} — cannot modify`, 409);
  }

  // Verify the step belongs to this application + is pending.
  const { data: step } = await sb
    .from("application_steps")
    .select("id, status")
    .eq("id", parsed.data.step_id)
    .eq("application_id", applicationId)
    .single();
  if (!step) return apiError("Step not found", 404);
  if (step.status !== "pending") return apiError("Step already completed", 409);

  let result;
  try {
    result = await recordResponseAndAdvance({
      applicationId,
      stepId: parsed.data.step_id,
      responseData: parsed.data.response_data,
    });
  } catch (err) {
    return apiError(`Advance failed: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }

  return apiSuccess({
    is_complete: result.complete,
    next_step: result.complete ? null : result.step,
  });
}
