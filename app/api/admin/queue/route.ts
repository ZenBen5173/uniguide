/**
 * GET /api/admin/queue
 *
 * Returns pending admin briefings for the staff dashboard.
 */

import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET() {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  const service = getServiceSupabase();

  // Verify staff role.
  const { data: staffProfile } = await service
    .from("staff_profiles")
    .select("user_id, full_name, faculty, staff_role")
    .eq("user_id", user.id)
    .single();
  if (!staffProfile) return apiError("Staff role required", 403);

  const { data: briefings } = await service
    .from("admin_briefings")
    .select("id, workflow_id, extracted_facts, flags, recommendation, reasoning, status, created_at, workflows(procedure_id, user_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return apiSuccess({ staff: staffProfile, briefings: briefings ?? [] });
}
