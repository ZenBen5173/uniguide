/**
 * Persist a GLM-generated workflow plan to the database as workflow_stages,
 * workflow_steps, and workflow_edges rows.
 *
 * After persistence the first stage (ordinal 0) is marked 'active'; the
 * workflow status moves from 'planning' to 'active'.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import type { PlanWorkflowOutput } from "@/lib/glm/schemas";

export async function persistPlan(args: {
  workflowId: string;
  plan: PlanWorkflowOutput;
}): Promise<void> {
  const sb = getServiceSupabase();
  const { workflowId, plan } = args;

  // Insert stages.
  const stageRows = plan.stages.map((s) => ({
    workflow_id: workflowId,
    ordinal: s.ordinal,
    label: s.label,
    node_type: s.node_type,
    status: s.ordinal === 0 ? "active" : "locked",
    assignee_role: s.assignee_role,
    metadata: s.metadata ?? {},
  }));
  const { data: insertedStages, error: stagesErr } = await sb
    .from("workflow_stages")
    .insert(stageRows)
    .select("id, ordinal");
  if (stagesErr || !insertedStages) {
    throw new Error(`persistPlan: failed to insert stages — ${stagesErr?.message}`);
  }

  const ordToId = new Map<number, string>(
    insertedStages.map((s: { id: string; ordinal: number }) => [s.ordinal, s.id])
  );

  // Insert steps.
  const stepRows = plan.stages.flatMap((stage) => {
    const stageId = ordToId.get(stage.ordinal);
    if (!stageId) return [];
    return stage.steps.map((step) => ({
      stage_id: stageId,
      ordinal: step.ordinal,
      type: step.type,
      label: step.label,
      config: step.config ?? {},
      required: step.required,
    }));
  });
  if (stepRows.length > 0) {
    const { error: stepsErr } = await sb.from("workflow_steps").insert(stepRows);
    if (stepsErr) throw new Error(`persistPlan: failed to insert steps — ${stepsErr.message}`);
  }

  // Insert edges.
  const edgeRows = plan.edges
    .map((e) => {
      const source = ordToId.get(e.source_ordinal);
      const target = ordToId.get(e.target_ordinal);
      if (!source || !target) return null;
      return {
        workflow_id: workflowId,
        source_stage_id: source,
        target_stage_id: target,
        condition_key: e.condition_key,
        label: e.label,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
  if (edgeRows.length > 0) {
    const { error: edgesErr } = await sb.from("workflow_edges").insert(edgeRows);
    if (edgesErr) throw new Error(`persistPlan: failed to insert edges — ${edgesErr.message}`);
  }

  // Update workflow with snapshot + status.
  await sb
    .from("workflows")
    .update({ status: "active", plan_snapshot: plan as unknown as Record<string, unknown> })
    .eq("id", workflowId);
}
