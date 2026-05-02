/**
 * POST /api/coordinator/applications/[id]/resolve-escalation
 *
 * Coordinator marks an open escalation as resolved. Optionally accepts a
 * final coordinator-authored message to insert into the chat thread.
 * Clears escalation_pending; the chat thread itself is preserved.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  final_message: z.string().min(1).max(4000).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — a no-message resolve is allowed.
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("id, escalation_pending")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (!app.escalation_pending) {
    return apiError("No open escalation to resolve.", 409);
  }

  if (parsed.data.final_message) {
    const { error: msgErr } = await sb
      .from("application_messages")
      .insert({
        application_id: applicationId,
        author_id: user.id,
        author_role: "coordinator",
        kind: "chat",
        body: parsed.data.final_message,
      });
    if (msgErr) {
      return apiError(`Failed to record final message: ${msgErr.message}`, 500);
    }
  }

  await sb
    .from("applications")
    .update({
      escalation_pending: false,
      escalation_resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  return apiSuccess({ resolved: true });
}
