/**
 * POST /api/coordinator/applications/[id]/undo
 *
 * Reverts the most recent decision on an application within 5 minutes.
 * Deletes the decision row, deletes the letter created with it, resets
 * the application status to "submitted" and decided_at to null. Briefing
 * stays as-is (a new decide call will resolve it again).
 *
 * 5 minutes is the safety window — long enough to catch a misclick, short
 * enough that a real student isn't checking back yet.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const UNDO_WINDOW_MS = 5 * 60 * 1000;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("id, status, decided_at")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);

  if (!app.decided_at) return apiError("Application has no decision to undo", 409);
  if (!["approved", "rejected"].includes(app.status)) {
    return apiError(`Cannot undo from status ${app.status}`, 409);
  }

  const decidedMs = new Date(app.decided_at).getTime();
  const ageMs = Date.now() - decidedMs;
  if (ageMs > UNDO_WINDOW_MS) {
    return apiError(
      `Undo window has closed (decision was ${Math.floor(ageMs / 60000)} minutes ago, limit 5).`,
      409
    );
  }

  const { data: latestDecision } = await sb
    .from("application_decisions")
    .select("id, decision, decided_at")
    .eq("application_id", applicationId)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await sb
    .from("application_letters")
    .delete()
    .eq("application_id", applicationId)
    .gte("created_at", app.decided_at);

  if (latestDecision) {
    await sb.from("application_decisions").delete().eq("id", latestDecision.id);
  }

  await sb
    .from("applications")
    .update({
      status: "submitted",
      decided_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  return apiSuccess({
    undone: true,
    new_status: "submitted",
    seconds_into_window: Math.floor(ageMs / 1000),
  });
}
