/**
 * POST /api/applications/[id]/withdraw
 *
 * Student-initiated cancellation. Allowed from draft, submitted, under_review,
 * or more_info_requested. NOT allowed once approved/rejected/withdrawn.
 *
 * Sets status to 'withdrawn' and stamps decided_at. Files and steps remain
 * for audit (we don't hard-delete student data).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  reason: z.string().max(500).optional(),
});

const WITHDRAWABLE_STATUSES = ["draft", "submitted", "under_review", "more_info_requested"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id: applicationId } = await ctx.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }
  const parsed = Body.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : undefined;

  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("id, user_id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (app.user_id !== user.id) return apiError("Forbidden", 403);
  if (!WITHDRAWABLE_STATUSES.includes(app.status)) {
    return apiError(`Cannot withdraw an application that is ${app.status}`, 409);
  }

  // Audit: record the withdrawal as a "decision" so it shows in history.
  await sb.from("application_decisions").insert({
    application_id: applicationId,
    decided_by: user.id,
    decision: "withdrawn",
    comment: reason ?? null,
  });

  await sb
    .from("applications")
    .update({
      status: "withdrawn",
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  return apiSuccess({ withdrawn: true });
}
