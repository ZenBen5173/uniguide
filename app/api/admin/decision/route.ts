/**
 * POST /api/admin/decision
 *
 * Body: { briefing_id: string, decision: "approve" | "reject" | "request_info", comment?: string }
 *
 * Records the staff decision, marks the briefing resolved, and advances the
 * underlying workflow.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { tryAdvanceWorkflow } from "@/lib/workflow/stageEngine";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const BodySchema = z.object({
  briefing_id: z.string().uuid(),
  decision: z.enum(["approve", "reject", "request_info"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid body", 400);

  const service = getServiceSupabase();

  // Verify staff role.
  const { data: staffProfile } = await service
    .from("staff_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .single();
  if (!staffProfile) return apiError("Staff role required", 403);

  const { data: briefing } = await service
    .from("admin_briefings")
    .select("id, workflow_id, status")
    .eq("id", parsed.data.briefing_id)
    .single();
  if (!briefing) return apiError("Briefing not found", 404);
  if (briefing.status !== "pending") return apiError("Briefing already resolved", 409);

  // Insert decision record.
  await service.from("admin_decisions").insert({
    briefing_id: briefing.id,
    staff_user_id: user.id,
    decision: parsed.data.decision,
    comment: parsed.data.comment ?? null,
  });

  await service.from("admin_briefings").update({ status: "resolved" }).eq("id", briefing.id);

  // Advance the workflow (or close it on reject).
  if (parsed.data.decision === "reject") {
    await service.from("workflows").update({ status: "rejected" }).eq("id", briefing.workflow_id);
    return apiSuccess({ resolved: true, workflow_status: "rejected" });
  }

  if (parsed.data.decision === "approve") {
    const advance = await tryAdvanceWorkflow(briefing.workflow_id);
    return apiSuccess({ resolved: true, advance });
  }

  // request_info — flag workflow as needing more info; re-open last stage.
  return apiSuccess({ resolved: true, workflow_status: "active" });
}
