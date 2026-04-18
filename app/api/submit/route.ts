/**
 * POST /api/submit
 *
 * Body: { workflow_id: string }
 *
 * Marks the workflow as 'submitted', generates an admin briefing via GLM,
 * and inserts a pending row into admin_briefings for the coordinator queue.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { generateBriefing } from "@/lib/glm/generateBriefing";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const BodySchema = z.object({ workflow_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError("workflow_id required (uuid)", 400);

  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  const service = getServiceSupabase();

  const { data: wf } = await service
    .from("workflows")
    .select("id, user_id, procedure_id, status")
    .eq("id", parsed.data.workflow_id)
    .single();
  if (!wf) return apiError("Workflow not found", 404);
  if (wf.user_id !== user.id) return apiError("Forbidden", 403);

  // Gather all step responses for the briefing.
  const { data: stages } = await service
    .from("workflow_stages")
    .select("id, label")
    .eq("workflow_id", wf.id)
    .order("ordinal");

  const stageIds = (stages ?? []).map((s) => s.id);
  const { data: steps } = await service
    .from("workflow_steps")
    .select("id, stage_id, label")
    .in("stage_id", stageIds);
  const stepLabelById = new Map((steps ?? []).map((s) => [s.id, s.label]));

  const stepIds = (steps ?? []).map((s) => s.id);
  const { data: responses } = await service
    .from("step_responses")
    .select("step_id, response_data")
    .in("step_id", stepIds);

  const responseList = (responses ?? []).map((r) => ({
    step_label: stepLabelById.get(r.step_id) ?? "(unknown step)",
    response_data: r.response_data,
  }));

  const { data: procedure } = await service
    .from("procedures")
    .select("name")
    .eq("id", wf.procedure_id)
    .single();

  const briefing = await generateBriefing(
    {
      workflowSummary: `${procedure?.name ?? wf.procedure_id} for user ${user.id}`,
      responses: responseList,
      procedureName: procedure?.name ?? wf.procedure_id,
    },
    { workflowId: wf.id }
  );

  const { data: insertedBriefing, error: insErr } = await service
    .from("admin_briefings")
    .insert({
      workflow_id: wf.id,
      extracted_facts: briefing.extracted_facts,
      flags: briefing.flags,
      recommendation: briefing.recommendation,
      reasoning: briefing.reasoning,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !insertedBriefing)
    return apiError(`Failed to create briefing: ${insErr?.message}`, 500);

  await service.from("workflows").update({ status: "submitted" }).eq("id", wf.id);

  return apiSuccess({
    submitted: true,
    briefing_id: insertedBriefing.id,
    recommendation: briefing.recommendation,
  });
}
