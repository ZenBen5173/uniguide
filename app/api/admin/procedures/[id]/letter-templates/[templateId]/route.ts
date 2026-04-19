/**
 * DELETE /api/admin/procedures/[id]/letter-templates/[templateId]
 * Remove a letter template. Admin only.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; templateId: string }> }
) {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  const { id: procedureId, templateId } = await ctx.params;
  const sb = getServiceSupabase();

  const { error } = await sb
    .from("procedure_letter_templates")
    .delete()
    .eq("id", templateId)
    .eq("procedure_id", procedureId);

  if (error) return apiError(`Delete failed: ${error.message}`, 500);
  return apiSuccess({ deleted: true });
}
