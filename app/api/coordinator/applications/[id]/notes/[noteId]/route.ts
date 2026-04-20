/**
 * DELETE /api/coordinator/applications/[id]/notes/[noteId]
 * Author-only delete of an internal note.
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> }
) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId, noteId } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: note } = await sb
    .from("application_coordinator_notes")
    .select("id, author_id")
    .eq("id", noteId)
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!note) return apiError("Note not found", 404);
  if (note.author_id !== user.id) return apiError("You can only delete your own notes", 403);

  await sb.from("application_coordinator_notes").delete().eq("id", noteId);
  return apiSuccess({ deleted: true });
}
