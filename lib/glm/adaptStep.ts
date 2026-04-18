/**
 * adaptStep — rewrites a generic step into a personalised question for the student.
 *
 * Cheap, frequent, low-stakes — uses glm-4.5-flash.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  AdaptStepInputSchema,
  AdaptStepOutputSchema,
  type AdaptStepOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function adaptStep(
  input: unknown,
  opts: { workflowId?: string | null } = {}
): Promise<AdaptStepOutput> {
  const validated = AdaptStepInputSchema.parse(input);
  const systemPrompt = loadPrompt("adapt");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.5-flash",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 400,
    temperature: 0.3,
    mockFixture: "adapt_default",
  });

  const parsed = AdaptStepOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.workflowId ?? null,
    endpoint: "adapt",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: { step_label: validated.step.label, step_type: validated.step.type },
    output: parsed,
    result,
  });

  return parsed;
}
