/**
 * POST /api/plan
 *
 * Body: { workflow_id: string }
 *
 * Generates the workflow plan via GLM and persists stages/steps/edges.
 * Idempotent: if the workflow already has stages, returns the existing plan.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { planWorkflow } from "@/lib/glm/planWorkflow";
import { ProcedureIdSchema } from "@/lib/glm/schemas";
import { persistPlan } from "@/lib/workflow/persistPlan";
import { retrieveProcedureSop } from "@/lib/kb/retrieve";
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

  // Load workflow and student profile.
  const { data: wf, error: wfErr } = await service
    .from("workflows")
    .select("id, user_id, procedure_id, intent_text, status")
    .eq("id", parsed.data.workflow_id)
    .single();
  if (wfErr || !wf) return apiError("Workflow not found", 404);
  if (wf.user_id !== user.id) return apiError("Forbidden", 403);

  // Idempotency: if already planned, just return existing stages.
  const { data: existingStages } = await service
    .from("workflow_stages")
    .select("id, ordinal, label, node_type, status")
    .eq("workflow_id", wf.id);
  if (existingStages && existingStages.length > 0) {
    return apiSuccess({ workflow_id: wf.id, kind: "already_planned", stage_count: existingStages.length });
  }

  const { data: profile } = await service
    .from("student_profiles")
    .select("faculty, programme, year, cgpa, citizenship")
    .eq("user_id", user.id)
    .single();

  const procedureId = ProcedureIdSchema.parse(wf.procedure_id);
  const sopChunks = await retrieveProcedureSop(procedureId);

  let plan;
  try {
    plan = await planWorkflow(
      {
        procedureId,
        profile: {
          faculty: profile?.faculty ?? null,
          programme: profile?.programme ?? null,
          year: profile?.year ?? null,
          cgpa: profile?.cgpa ?? null,
          citizenship: profile?.citizenship ?? "MY",
        },
        intentText: wf.intent_text,
        sopChunks,
      },
      { workflowId: wf.id }
    );
  } catch (err) {
    return apiError(`Planning failed: ${err instanceof Error ? err.message : "unknown"}`, 502);
  }

  try {
    await persistPlan({ workflowId: wf.id, plan });
  } catch (err) {
    return apiError(`Plan persistence failed: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }

  return apiSuccess({
    workflow_id: wf.id,
    kind: "planned",
    stage_count: plan.stages.length,
    edge_count: plan.edges.length,
  });
}
