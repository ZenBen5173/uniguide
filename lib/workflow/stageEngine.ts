/**
 * Stage engine — advances a workflow through stages atomically.
 *
 * Pattern borrowed conceptually from FlowNote (the team's reference codebase):
 *  - check if all required steps in the current stage are complete
 *  - if yes, mark stage completed
 *  - find the next stage by following an outgoing edge:
 *      * stage node: follow the unconditional edge (or the only edge)
 *      * decision node: call GLM routeDecision to pick an edge
 *      * end node: mark workflow done
 *  - mark next stage as 'active'
 *
 * For MVP, executes as a series of supabase calls. Upgrade to a single
 * Postgres RPC (see TODO) when concurrency stress-testing exposes races.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import type {
  EdgeRecord,
  StageRecord,
  StepRecord,
  StepResponseRecord,
} from "./types";
import { routeDecision, ROUTE_DECISION_CONFIDENCE_THRESHOLD } from "@/lib/glm/routeDecision";
import { generateBriefing } from "@/lib/glm/generateBriefing";

export interface AdvanceResult {
  advanced: boolean;
  nextStageId: string | null;
  workflowCompleted: boolean;
  needsClarification?: { question: string };
  reason?: string;
}

/**
 * Try to advance a workflow from its current active stage.
 * Caller must have authority to advance (student finishing their step,
 * or coordinator approving).
 */
export async function tryAdvanceWorkflow(workflowId: string): Promise<AdvanceResult> {
  const sb = getServiceSupabase();

  const { data: stages, error: stagesErr } = await sb
    .from("workflow_stages")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("ordinal");
  if (stagesErr || !stages) {
    return { advanced: false, nextStageId: null, workflowCompleted: false, reason: stagesErr?.message };
  }

  const activeStage = stages.find((s: StageRecord) => s.status === "active");
  if (!activeStage) {
    return { advanced: false, nextStageId: null, workflowCompleted: false, reason: "no active stage" };
  }

  // Are all required steps in active stage complete?
  const { data: steps } = await sb
    .from("workflow_steps")
    .select("*")
    .eq("stage_id", activeStage.id);

  const required = (steps ?? []).filter((s: StepRecord) => s.required);
  const allDone = required.every((s: StepRecord) => s.status === "completed");
  if (!allDone) {
    return { advanced: false, nextStageId: null, workflowCompleted: false, reason: "stage steps incomplete" };
  }

  // Mark active stage as completed.
  await sb
    .from("workflow_stages")
    .update({ status: "completed" })
    .eq("id", activeStage.id);

  // If activeStage is an end node, finish workflow.
  if (activeStage.node_type === "end") {
    const outcome = (activeStage.metadata as { outcome?: string })?.outcome ?? "completed";
    await sb
      .from("workflows")
      .update({ status: outcome === "rejected" ? "rejected" : "approved" })
      .eq("id", workflowId);
    return { advanced: true, nextStageId: null, workflowCompleted: true };
  }

  // Find outgoing edges.
  const { data: edges } = await sb
    .from("workflow_edges")
    .select("*")
    .eq("source_stage_id", activeStage.id);

  if (!edges || edges.length === 0) {
    return { advanced: false, nextStageId: null, workflowCompleted: false, reason: "no outgoing edge" };
  }

  let chosenEdge: EdgeRecord | null = null;

  // Decision node: call GLM to pick.
  if (activeStage.node_type === "decision") {
    const branches = edges.map((e: EdgeRecord) => {
      const target = stages.find((s: StageRecord) => s.id === e.target_stage_id);
      const branchMeta = (activeStage.metadata as { branches?: Array<{ condition_key: string; criteria: string }> })?.branches;
      const criteria =
        branchMeta?.find((b) => b.condition_key === e.condition_key)?.criteria ?? "";
      return {
        condition_key: e.condition_key ?? "",
        target_label: target?.label ?? "",
        criteria,
      };
    });

    // Gather prior responses from earlier stages.
    const { data: priorResponses } = await sb
      .from("step_responses")
      .select("step_id, response_data, workflow_steps(label, stage_id)")
      .in(
        "step_id",
        ((steps as StepRecord[]) ?? []).map((s) => s.id)
      );
    const responsesForGlm = (priorResponses ?? []).map((r: any) => ({
      step_label: r.workflow_steps?.label ?? "",
      response: r.response_data,
    }));

    const decision = await routeDecision(
      {
        decisionNode: { label: activeStage.label, branches },
        priorResponses: responsesForGlm,
      },
      { workflowId }
    );

    if (
      decision.needs_clarification ||
      decision.confidence < ROUTE_DECISION_CONFIDENCE_THRESHOLD
    ) {
      // Re-mark stage as active so the user can clarify.
      await sb
        .from("workflow_stages")
        .update({ status: "active" })
        .eq("id", activeStage.id);
      return {
        advanced: false,
        nextStageId: activeStage.id,
        workflowCompleted: false,
        needsClarification: {
          question:
            decision.clarification_question ??
            "I need a bit more detail to decide which path to take. Could you clarify?",
        },
      };
    }

    chosenEdge = edges.find((e: EdgeRecord) => e.condition_key === decision.selected_condition_key) ?? null;
  } else {
    // Stage node: prefer unconditional edge; otherwise first edge.
    chosenEdge = edges.find((e: EdgeRecord) => !e.condition_key) ?? edges[0];
  }

  if (!chosenEdge) {
    return { advanced: false, nextStageId: null, workflowCompleted: false, reason: "no edge selected" };
  }

  await sb
    .from("workflow_stages")
    .update({ status: "active" })
    .eq("id", chosenEdge.target_stage_id);

  const newActiveStage = stages.find((s: StageRecord) => s.id === chosenEdge!.target_stage_id);

  // If the new active stage is a decision node OR an end node, recurse —
  // the user has nothing to click for either, so advance them automatically.
  if (
    newActiveStage &&
    (newActiveStage.node_type === "decision" || newActiveStage.node_type === "end")
  ) {
    return tryAdvanceWorkflow(workflowId);
  }

  // If the new active stage is assigned to a non-student role (coordinator,
  // dean, etc.), the student's part is done for now — generate a briefing
  // for the assignee so it appears in their queue.
  if (
    newActiveStage &&
    newActiveStage.assignee_role &&
    newActiveStage.assignee_role !== "student" &&
    newActiveStage.assignee_role !== "system"
  ) {
    await ensureBriefing(workflowId, sb);
    await sb.from("workflows").update({ status: "submitted" }).eq("id", workflowId);
  }

  return {
    advanced: true,
    nextStageId: chosenEdge.target_stage_id,
    workflowCompleted: false,
  };
}

/**
 * Generate (or skip if exists) a coordinator briefing for the workflow.
 * Idempotent — if a pending briefing already exists, do nothing.
 */
async function ensureBriefing(
  workflowId: string,
  sb: ReturnType<typeof getServiceSupabase>
): Promise<void> {
  const { data: existing } = await sb
    .from("admin_briefings")
    .select("id, status")
    .eq("workflow_id", workflowId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return;

  // Gather workflow context.
  const { data: wf } = await sb
    .from("workflows")
    .select("id, procedure_id, user_id")
    .eq("id", workflowId)
    .single();
  if (!wf) return;

  const { data: stages } = await sb
    .from("workflow_stages")
    .select("id, label")
    .eq("workflow_id", workflowId);
  const stageIds = (stages ?? []).map((s) => s.id);

  const { data: steps } = await sb
    .from("workflow_steps")
    .select("id, stage_id, label")
    .in("stage_id", stageIds);
  const stepLabelById = new Map((steps ?? []).map((s) => [s.id, s.label]));
  const stepIds = (steps ?? []).map((s) => s.id);

  const { data: responses } = await sb
    .from("step_responses")
    .select("step_id, response_data")
    .in("step_id", stepIds);

  const responseList = (responses ?? []).map((r) => ({
    step_label: stepLabelById.get(r.step_id) ?? "(unknown step)",
    response_data: r.response_data,
  }));

  const { data: procedure } = await sb
    .from("procedures")
    .select("name")
    .eq("id", wf.procedure_id)
    .single();

  let briefing;
  try {
    briefing = await generateBriefing(
      {
        workflowSummary: `${procedure?.name ?? wf.procedure_id} for user ${wf.user_id}`,
        responses: responseList,
        procedureName: procedure?.name ?? wf.procedure_id,
      },
      { workflowId }
    );
  } catch (err) {
    console.error("[ensureBriefing] generateBriefing failed", err);
    return;
  }

  await sb.from("admin_briefings").insert({
    workflow_id: workflowId,
    extracted_facts: briefing.extracted_facts,
    flags: briefing.flags,
    recommendation: briefing.recommendation,
    reasoning: briefing.reasoning,
    status: "pending",
  });
}

/**
 * Mark a step response as received and try to advance the workflow.
 */
export async function recordStepResponse(args: {
  stepId: string;
  userId: string;
  responseData: Record<string, unknown>;
}): Promise<{ saved: boolean; advance: AdvanceResult | null }> {
  const sb = getServiceSupabase();

  // Upsert the response (one response per step; latest wins).
  const { error: respErr } = await sb
    .from("step_responses")
    .upsert(
      {
        step_id: args.stepId,
        user_id: args.userId,
        response_data: args.responseData,
        responded_at: new Date().toISOString(),
      },
      { onConflict: "step_id" }
    );
  if (respErr) return { saved: false, advance: null };

  await sb.from("workflow_steps").update({ status: "completed" }).eq("id", args.stepId);

  const { data: step } = await sb
    .from("workflow_steps")
    .select("stage_id, workflow_stages(workflow_id)")
    .eq("id", args.stepId)
    .single();

  const workflowId = (step?.workflow_stages as any)?.workflow_id;
  if (!workflowId) return { saved: true, advance: null };

  const advance = await tryAdvanceWorkflow(workflowId);
  return { saved: true, advance };
}
