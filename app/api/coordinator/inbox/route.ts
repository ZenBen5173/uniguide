/**
 * GET /api/coordinator/inbox
 *
 * Returns the inbox queue for a coordinator: applications grouped by status,
 * with their briefings inlined for the table view. Sorted by AI urgency
 * (low confidence + flagged first).
 *
 * Optional query params:
 *  - status: filter (defaults to "all")
 *  - procedure_id: filter
 */

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET(req: NextRequest) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "all";
  const procedureFilter = searchParams.get("procedure_id");

  const sb = getServiceSupabase();

  let query = sb
    .from("applications")
    .select(`
      id, user_id, procedure_id, status, ai_recommendation, ai_confidence,
      student_summary, submitted_at, decided_at, created_at,
      assigned_to, assigned_at,
      procedures(name),
      student_profiles!applications_user_id_fkey(full_name, faculty, programme, year, cgpa, citizenship)
    `)
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (statusFilter !== "all") {
    if (statusFilter === "pending") {
      query = query.in("status", ["submitted", "more_info_requested"]);
    } else {
      query = query.eq("status", statusFilter);
    }
  }
  if (procedureFilter) query = query.eq("procedure_id", procedureFilter);

  const { data: applications, error } = await query;
  if (error) return apiError(`Inbox query failed: ${error.message}`, 500);

  // Inline briefing flags so the table can show them.
  const ids = (applications ?? []).map((a) => a.id);
  const { data: briefings } = ids.length
    ? await sb.from("application_briefings").select("application_id, flags").in("application_id", ids)
    : { data: [] };
  const flagsByApp = new Map(
    (briefings ?? []).map((b) => [b.application_id, b.flags])
  );

  // Inbox metrics
  const counts = { pending: 0, approved: 0, rejected: 0, more_info: 0 };
  for (const a of applications ?? []) {
    if (a.status === "submitted") counts.pending++;
    else if (a.status === "approved") counts.approved++;
    else if (a.status === "rejected") counts.rejected++;
    else if (a.status === "more_info_requested") counts.more_info++;
  }

  // Resolve assignee names for the rows that have one.
  const assignedIds = [...new Set((applications ?? [])
    .map((a) => a.assigned_to)
    .filter((x): x is string => typeof x === "string"))];
  const { data: assigneeProfiles } = assignedIds.length
    ? await sb.from("staff_profiles").select("user_id, full_name").in("user_id", assignedIds)
    : { data: [] };
  const assigneeNameById = new Map((assigneeProfiles ?? []).map((p) => [p.user_id, p.full_name]));

  const enriched = (applications ?? []).map((a) => ({
    ...a,
    flags: flagsByApp.get(a.id) ?? [],
    assignee_name: a.assigned_to ? assigneeNameById.get(a.assigned_to) ?? "Coordinator" : null,
  }));

  return apiSuccess({
    counts,
    applications: enriched,
    coordinator: { id: user.id, email: user.email, role: user.role },
  });
}
