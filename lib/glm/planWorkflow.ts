/**
 * planWorkflow — emits the structured workflow JSON that gets rendered on the canvas.
 *
 * This is the most important GLM endpoint in the app. The output of this call
 * becomes the entire structure of the student's journey.
 *
 * Validation is strict: schema check + graph integrity check (no cycles,
 * no dead ends, all edges reference existing stages).
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  PlanWorkflowInputSchema,
  PlanWorkflowOutputSchema,
  type PlanWorkflowInput,
  type PlanWorkflowOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function planWorkflow(
  input: PlanWorkflowInput,
  opts: { workflowId?: string | null } = {}
): Promise<PlanWorkflowOutput> {
  const validated = PlanWorkflowInputSchema.parse(input);
  const systemPrompt = loadPrompt("plan");
  const userPrompt = JSON.stringify({
    procedureId: validated.procedureId,
    profile: validated.profile,
    intentText: validated.intentText,
    sopExcerpts: validated.sopChunks,
  });

  let parsed: PlanWorkflowOutput | null = null;
  let lastError: string | null = null;
  let retryCount = 0;
  let result: Awaited<ReturnType<typeof callGlm>>;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctivePrompt =
      attempt === 0
        ? systemPrompt
        : `${systemPrompt}\n\nYour previous response failed validation: ${lastError}\nReturn ONLY valid JSON matching the schema, with no graph cycles or dead-end stages.`;

    result = await callGlm({
      model: "glm-4.6",
      systemPrompt: correctivePrompt,
      userPrompt,
      jsonMode: true,
      maxTokens: 3000,
      temperature: 0.2,
      mockFixture: `plan_${validated.procedureId}`,
    });

    try {
      const schemaOk = PlanWorkflowOutputSchema.parse(JSON.parse(result.text));
      const graphOk = validateGraph(schemaOk);
      if (graphOk.ok) {
        parsed = schemaOk;
        break;
      }
      lastError = graphOk.error;
      retryCount++;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retryCount++;
    }
  }

  if (!parsed) {
    throw new Error(`planWorkflow failed validation after retry: ${lastError}`);
  }

  await writeTrace({
    workflowId: opts.workflowId ?? null,
    endpoint: "plan",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      procedureId: validated.procedureId,
      profile: validated.profile,
      sop_chunk_count: validated.sopChunks.length,
    },
    output: { stage_count: parsed.stages.length, edge_count: parsed.edges.length },
    result: result!,
    retryCount,
  });

  return parsed;
}

/**
 * Validate the workflow plan as a directed acyclic graph:
 *   - all stages have unique ordinals
 *   - all edges reference existing stage ordinals
 *   - no cycles
 *   - every non-end stage has at least one outgoing edge
 *   - start (ordinal 0) is reachable
 */
function validateGraph(plan: PlanWorkflowOutput): { ok: true } | { ok: false; error: string } {
  const ordinals = new Set(plan.stages.map((s) => s.ordinal));
  if (ordinals.size !== plan.stages.length) {
    return { ok: false, error: "Duplicate stage ordinals" };
  }

  for (const edge of plan.edges) {
    if (!ordinals.has(edge.source_ordinal)) {
      return { ok: false, error: `Edge source ${edge.source_ordinal} not in stages` };
    }
    if (!ordinals.has(edge.target_ordinal)) {
      return { ok: false, error: `Edge target ${edge.target_ordinal} not in stages` };
    }
  }

  // dead-end check
  const endOrdinals = new Set(
    plan.stages.filter((s) => s.node_type === "end").map((s) => s.ordinal)
  );
  const sourcesWithEdges = new Set(plan.edges.map((e) => e.source_ordinal));
  for (const stage of plan.stages) {
    if (stage.node_type === "end") continue;
    if (!sourcesWithEdges.has(stage.ordinal)) {
      return { ok: false, error: `Non-end stage ${stage.ordinal} has no outgoing edge` };
    }
  }

  // cycle detection (DFS)
  const adj = new Map<number, number[]>();
  for (const edge of plan.edges) {
    if (!adj.has(edge.source_ordinal)) adj.set(edge.source_ordinal, []);
    adj.get(edge.source_ordinal)!.push(edge.target_ordinal);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const colour = new Map<number, number>();
  for (const ord of ordinals) colour.set(ord, WHITE);

  function dfs(node: number): boolean {
    colour.set(node, GRAY);
    for (const next of adj.get(node) ?? []) {
      const c = colour.get(next);
      if (c === GRAY) return true; // back edge → cycle
      if (c === WHITE && dfs(next)) return true;
    }
    colour.set(node, BLACK);
    return false;
  }

  for (const ord of ordinals) {
    if (colour.get(ord) === WHITE && dfs(ord)) {
      return { ok: false, error: "Cycle detected in workflow graph" };
    }
  }

  return { ok: true };
}
