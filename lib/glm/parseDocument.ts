/**
 * parseDocument — extract structured fields from an uploaded document.
 *
 * The caller is responsible for converting the file (PDF/image) to text
 * before passing it in (use lib/documents/extractText.ts).
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  ParseDocumentInputSchema,
  ParseDocumentOutputSchema,
  type ParseDocumentOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function parseDocument(
  input: unknown,
  opts: { workflowId?: string | null } = {}
): Promise<ParseDocumentOutput> {
  const validated = ParseDocumentInputSchema.parse(input);
  const systemPrompt = loadPrompt("parse");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.6",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 2000,
    temperature: 0.1,
    mockFixture: "parse_offer_letter",
  });

  const parsed = ParseDocumentOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.workflowId ?? null,
    endpoint: "parse",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      doc_length: validated.documentText.length,
      requested_fields: Object.keys(validated.extractionSchema),
    },
    output: { extracted_field_count: Object.keys(parsed.fields).length },
    result,
  });

  return parsed;
}
