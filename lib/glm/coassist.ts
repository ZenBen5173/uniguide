/**
 * coassist — the coordinator's natural-language "tweak this" channel for an
 * artifact they're already reviewing. Three artifacts are supported today:
 *
 *   • "letter"             — revise the AI-drafted decision letter in the
 *                            preview-letter modal.
 *   • "step_prompt"        — revise the AI's proposed Request-More-Info
 *                            question in the preview-step modal.
 *   • "briefing_reasoning" — Q&A about the coordinator's briefing. The
 *                            briefing record itself is NOT mutated here —
 *                            this is a chat surface, not an editor.
 *
 * Each call is independent; pass `priorTurns` if the coordinator is
 * iterating in the same modal session.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  CoassistInputSchema,
  CoassistOutputSchema,
  type CoassistOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function coassist(
  input: unknown,
  opts: { applicationId?: string | null } = {}
): Promise<CoassistOutput> {
  const validated = CoassistInputSchema.parse(input);
  const systemPrompt = loadPrompt("coassist");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    // glm-4.5-flash for finals stability — see generateBriefing.ts header.
    model: "glm-4.5-flash",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 2500,
    temperature: 0.2,
    mockFixture: `coassist_${validated.artifact}`,
  });

  const parsed = CoassistOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.applicationId ?? null,
    endpoint: "coassist",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      artifact: validated.artifact,
      instruction_length: validated.instruction.length,
      current_text_length: validated.currentText.length,
      sop_chunk_count: validated.sopChunks.length,
      prior_turn_count: validated.priorTurns.length,
    },
    output: { revised_length: parsed.revised_text.length },
    result,
  });

  return parsed;
}
