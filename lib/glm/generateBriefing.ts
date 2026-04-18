/**
 * generateBriefing — produce the coordinator-side briefing for a submitted
 * application.
 *
 * v2 signature: input is the application's running history (all step prompts +
 * student responses). GLM digests it into facts + flags + recommendation.
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
  opts: { applicationId?: string | null } = {}
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
    workflowId: opts.applicationId ?? null,
    endpoint: "brief",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      procedure: validated.procedureName,
      history_length: validated.history.length,
    },
    output: { recommendation: parsed.recommendation, flag_count: parsed.flags.length },
    result,
  });

  return parsed;
}
