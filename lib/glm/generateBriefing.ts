/**
 * generateBriefing — produce the admin-side briefing for a submitted workflow.
 *
 * Reads all the student's responses, surfaces facts and flags, and emits a
 * recommendation with reasoning. Coordinator sees this BEFORE the raw form.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  GenerateBriefingInputSchema,
  GenerateBriefingOutputSchema,
  type GenerateBriefingOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function generateBriefing(
  input: unknown,
  opts: { workflowId?: string | null } = {}
): Promise<GenerateBriefingOutput> {
  const validated = GenerateBriefingInputSchema.parse(input);
  const systemPrompt = loadPrompt("brief");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.6",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 1500,
    temperature: 0.2,
    mockFixture: "brief_scholarship_application",
  });

  const parsed = GenerateBriefingOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.workflowId ?? null,
    endpoint: "brief",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      procedure: validated.procedureName,
      response_count: validated.responses.length,
    },
    output: { recommendation: parsed.recommendation, flag_count: parsed.flags.length },
    result,
  });

  return parsed;
}
