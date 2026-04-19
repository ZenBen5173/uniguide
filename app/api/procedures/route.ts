/**
 * GET /api/procedures
 *
 * Public list of procedures for any authenticated user (students need this
 * for the portal tile grid). Admin-write actions stay on /api/admin/procedures.
 */

import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET() {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const sb = getServiceSupabase();

  const [{ data: procedures }, { data: chunks }, { data: applications }] = await Promise.all([
    sb.from("procedures").select("id, name, description, source_url, faculty_scope, indexed_at").order("name"),
    sb.from("procedure_sop_chunks").select("procedure_id"),
    sb.from("applications").select("procedure_id, status"),
  ]);

  const chunkCount = (chunks ?? []).reduce<Record<string, number>>(
    (acc, c) => ((acc[c.procedure_id] = (acc[c.procedure_id] || 0) + 1), acc), {}
  );
  const activeAppCount = (applications ?? []).filter((a) =>
    ["draft", "submitted", "under_review", "more_info_requested"].includes(a.status)
  ).reduce<Record<string, number>>((acc, a) => ((acc[a.procedure_id] = (acc[a.procedure_id] || 0) + 1), acc), {});

  const enriched = (procedures ?? []).map((p) => ({
    ...p,
    sop_chunks: chunkCount[p.id] ?? 0,
    active_applications: activeAppCount[p.id] ?? 0,
  }));

  return apiSuccess({ procedures: enriched });
}
