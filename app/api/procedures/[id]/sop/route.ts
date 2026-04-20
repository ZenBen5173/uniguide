/**
 * GET /api/procedures/[id]/sop
 *
 * Public-to-authenticated read of a procedure's indexed SOP chunks. Used by
 * the student-facing SOP viewer so applicants can audit "where did the AI
 * get this from?" instead of taking GLM's word.
 *
 * Returns chunks in their original order. Source URL included for citation.
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id: procedureId } = await ctx.params;
  const sb = getServiceSupabase();

  const [{ data: procedure }, { data: chunks }] = await Promise.all([
    sb.from("procedures").select("id, name, description, source_url, indexed_at").eq("id", procedureId).maybeSingle(),
    sb.from("procedure_sop_chunks").select("id, chunk_order, section, content, source_url").eq("procedure_id", procedureId).order("chunk_order"),
  ]);

  if (!procedure) return apiError("Procedure not found", 404);

  return apiSuccess({
    procedure,
    chunks: chunks ?? [],
  });
}
