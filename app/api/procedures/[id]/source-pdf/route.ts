/**
 * GET /api/procedures/[id]/source-pdf
 *
 * Mints a short-lived signed URL for the procedure's original SOP PDF and
 * redirects the caller. Used by the admin procedure-detail page's
 * "View original PDF" link, plus the student SOP viewer's "original ↗".
 *
 * Auth: any authenticated user. SOPs are reference material — students need
 * to be able to verify the source the AI is reading from.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError } from "@/lib/utils/responses";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id } = await ctx.params;
  const sb = getServiceSupabase();

  const { data: procedure } = await sb
    .from("procedures")
    .select("id, source_pdf_path")
    .eq("id", id)
    .maybeSingle();

  if (!procedure) return apiError("Procedure not found", 404);
  if (!procedure.source_pdf_path) {
    return apiError("No source PDF stored for this procedure", 404);
  }

  const { data, error } = await sb.storage
    .from("sop-sources")
    .createSignedUrl(procedure.source_pdf_path, 60 * 10); // 10 minutes

  if (error || !data?.signedUrl) {
    return apiError(`Could not sign PDF URL: ${error?.message ?? "unknown"}`, 500);
  }

  return NextResponse.redirect(data.signedUrl);
}
