/**
 * GET /api/workflow/:id
 *
 * Returns the full workflow with stages, steps, edges, and responses
 * needed to render the canvas and step pane.
 */

import { NextRequest } from "next/server";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  const service = getServiceSupabase();

  const { data: wf, error: wfErr } = await service
    .from("workflows")
    .select("id, user_id, procedure_id, status, intent_text, plan_snapshot, created_at, updated_at")
    .eq("id", id)
    .single();
  if (wfErr || !wf) return apiError("Workflow not found", 404);
  if (wf.user_id !== user.id) return apiError("Forbidden", 403);

  const [{ data: stages }, { data: steps }, { data: edges }, { data: responses }] = await Promise.all([
    service
      .from("workflow_stages")
      .select("id, ordinal, label, node_type, status, assignee_role, metadata")
      .eq("workflow_id", id)
      .order("ordinal"),
    service
      .from("workflow_steps")
      .select("id, stage_id, ordinal, type, label, config, required, status")
      .order("ordinal"),
    service
      .from("workflow_edges")
      .select("id, source_stage_id, target_stage_id, condition_key, label")
      .eq("workflow_id", id),
    service
      .from("step_responses")
      .select("id, step_id, response_data, responded_at"),
  ]);

  // Filter steps to only this workflow's stages (steps doesn't carry workflow_id).
  const stageIds = new Set((stages ?? []).map((s) => s.id));
  const filteredSteps = (steps ?? []).filter((s) => stageIds.has(s.stage_id));

  // Filter responses to only this workflow's steps.
  const stepIds = new Set(filteredSteps.map((s) => s.id));
  const filteredResponses = (responses ?? []).filter((r) => stepIds.has(r.step_id));

  return apiSuccess({
    workflow: wf,
    stages: stages ?? [],
    steps: filteredSteps,
    edges: edges ?? [],
    responses: filteredResponses,
  });
}
