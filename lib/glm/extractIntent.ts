/**
 * extractIntent — first GLM call in any workflow.
 *
 * Input: free-text from the student.
 * Output: classified procedure_id with confidence; or clarifying questions.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  ExtractIntentInputSchema,
  ExtractIntentOutputSchema,
  type ExtractIntentInput,
  type ExtractIntentOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function extractIntent(
  input: ExtractIntentInput,
  opts: { workflowId?: string | null } = {}
): Promise<ExtractIntentOutput> {
  const validated = ExtractIntentInputSchema.parse(input);
  const systemPrompt = loadPrompt("intent");
  const userPrompt = JSON.stringify({
    text: validated.text,
    availableProcedureIds: validated.availableProcedureIds,
  });

  let parsed: ExtractIntentOutput | null = null;
  let lastError: string | null = null;
  let retryCount = 0;
  let result: Awaited<ReturnType<typeof callGlm>>;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctivePrompt =
      attempt === 0
        ? systemPrompt
        : `${systemPrompt}\n\nYour previous response failed schema validation: ${lastError}\nReturn ONLY valid JSON matching the schema.`;

    result = await callGlm({
      model: "glm-4.5-flash",
      systemPrompt: correctivePrompt,
      userPrompt,
      jsonMode: true,
      maxTokens: 400,
      temperature: 0.1,
      mockFixture: pickIntentFixture(validated.text),
    });

    try {
      parsed = ExtractIntentOutputSchema.parse(JSON.parse(result.text));
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retryCount++;
    }
  }

  if (!parsed) {
    throw new Error(`extractIntent failed schema validation after retry: ${lastError}`);
  }

  await writeTrace({
    workflowId: opts.workflowId ?? null,
    endpoint: "intent",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: { text_length: validated.text.length },
    output: parsed,
    confidence: parsed.confidence,
    result: result!,
    retryCount,
  });

  return parsed;
}

/**
 * Heuristic mapper for mock mode — picks a fixture based on keywords in the input.
 * Real mode ignores this entirely.
 */
function pickIntentFixture(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("industrial") || t.includes("internship") || t.includes("intern"))
    return "intent_industrial_training";
  if (t.includes("defer") || t.includes("postpone")) return "intent_deferment";
  if (t.includes("appeal") && (t.includes("exam") || t.includes("grade")))
    return "intent_exam_appeal";
  if (t.includes("postgrad") || t.includes("master") || t.includes("phd"))
    return "intent_postgrad";
  if (t.includes("visa") || t.includes("emgs") || t.includes("pass"))
    return "intent_emgs";
  if (t.includes("fyp") || t.includes("final year project"))
    return "intent_fyp";
  return "intent_unknown";
}
