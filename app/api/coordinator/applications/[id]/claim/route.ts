/**
 * POST   /api/coordinator/applications/[id]/claim    claim/take this application
 * DELETE /api/coordinator/applications/[id]/claim    release (any coordinator can release any claim)
 *
 * Claim is advisory: any staff/admin may still act on the application.
 * It's a soft signal so two coordinators don't duplicate review.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();

  const { data, error } = await sb
    .from("applications")
    .update({
      assigned_to: user.id,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .select("id, assigned_to, assigned_at")
    .single();

  if (error) return apiError(error.message, 500);
  return apiSuccess({ application: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();

  await sb
    .from("applications")
    .update({
      assigned_to: null,
      assigned_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  return apiSuccess({ released: true });
}
