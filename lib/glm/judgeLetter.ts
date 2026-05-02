/**
 * judgeLetter — second-layer hallucination check on a filled decision letter.
 *
 * The regex layer in preview-letter / coassist catches *structural* mismatches:
 * unfilled placeholders, wrong CGPA digits, wrong year number, foreign faculty
 * codes, mismatched programme strings. It can't see semantic problems:
 *
 *   • Inventing a policy ("you must reapply within 14 days" — SOP says 30)
 *   • Fabricating a committee, scholarship office name, or signatory
 *   • Quoting a SOP §X.Y that doesn't exist in the SOP
 *   • Contradicting the briefing's reasoning ("approved" letter on a case
 *     the briefing recommended rejecting)
 *   • Promising a deadline / amount / coverage the SOP doesn't authorise
 *
 * judgeLetter runs the filled letter through GLM as an independent reviewer.
 * The briefing's reasoning text and SOP excerpts are the ground truth. The
 * judge returns a list of issues with severity, category, and a quotable
 * excerpt. Coordinator sees both layers in the modal.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  JudgeLetterInputSchema,
  JudgeLetterOutputSchema,
  type JudgeLetterOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function judgeLetter(
  input: unknown,
  opts: { applicationId?: string | null } = {}
): Promise<JudgeLetterOutput> {
  const validated = JudgeLetterInputSchema.parse(input);
  const systemPrompt = loadPrompt("judge_letter");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.6",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 1500,
    temperature: 0.1,
    mockFixture: `judge_letter_${validated.templateType}`,
  });

  const parsed = JudgeLetterOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.applicationId ?? null,
    endpoint: "judge_letter",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      template_type: validated.templateType,
      letter_length: validated.letterText.length,
      sop_chunk_count: validated.sopChunks.length,
      has_briefing: validated.briefingReasoning !== null,
    },
    output: {
      issue_count: parsed.issues.length,
      block_count: parsed.issues.filter((i) => i.severity === "block").length,
      warn_count: parsed.issues.filter((i) => i.severity === "warn").length,
      confidence: parsed.confidence,
    },
    confidence: parsed.confidence,
    result,
  });

  return parsed;
}
