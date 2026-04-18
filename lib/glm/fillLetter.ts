/**
 * fillLetter — fill a .docx-style template (markdown text with {{placeholders}})
 * with application data after a coordinator decision.
 *
 * Runs on Approve / Reject / Request More Info → produces the letter shown
 * to the student on their status page (and emailed if delivery is configured).
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  FillLetterInputSchema,
  FillLetterOutputSchema,
  type FillLetterOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function fillLetter(
  input: unknown,
  opts: { applicationId?: string | null } = {}
): Promise<FillLetterOutput> {
  const validated = FillLetterInputSchema.parse(input);
  const systemPrompt = loadPrompt("fill_letter");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.6",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 2500,
    temperature: 0.1,
    mockFixture: `fill_letter_${validated.templateType}`,
  });

  const parsed = FillLetterOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.applicationId ?? null,
    endpoint: "fill_letter",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      template_type: validated.templateType,
      placeholder_count: validated.detectedPlaceholders.length,
    },
    output: {
      filled: !!parsed.filled_text,
      unfilled_count: parsed.unfilled_placeholders.length,
    },
    result,
  });

  return parsed;
}
