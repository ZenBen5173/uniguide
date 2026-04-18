/**
 * estimateProgress — rough "Step X of ~Y" indicator for the student's
 * application page. Cheap, runs each turn (or cached per application).
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  EstimateProgressInputSchema,
  EstimateProgressOutputSchema,
  type EstimateProgressOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function estimateProgress(
  input: unknown,
  opts: { applicationId?: string | null } = {}
): Promise<EstimateProgressOutput> {
  const validated = EstimateProgressInputSchema.parse(input);
  const systemPrompt = loadPrompt("estimate_progress");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.5-flash",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 200,
    temperature: 0.1,
    mockFixture: `estimate_progress_${validated.procedureId}`,
  });

  const parsed = EstimateProgressOutputSchema.parse(JSON.parse(result.text));

  // Honour the rule: never under-count past completed.
  if (parsed.estimated_total_steps < validated.stepsCompletedSoFar + 1) {
    parsed.estimated_total_steps = validated.stepsCompletedSoFar + 1;
  }

  await writeTrace({
    workflowId: opts.applicationId ?? null,
    endpoint: "estimate_progress",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      procedureId: validated.procedureId,
      stepsCompletedSoFar: validated.stepsCompletedSoFar,
    },
    output: parsed,
    result,
  });

  return parsed;
}
