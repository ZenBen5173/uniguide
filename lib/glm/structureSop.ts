/**
 * structureSop — convert raw extracted SOP text into clean markdown with
 * `# H1` title + `## H2` section headers + bullet lists, so the downstream
 * /sop chunker (which splits by H2 + 400-word boundary) can carve it into
 * meaningful chunks.
 *
 * Why this exists: pdf-parse and mammoth produce mechanically-extracted text
 * that rarely has explicit `## H2` markers. Without structuring, every SOP
 * collapsed into ONE giant chunk because the chunker found no headers,
 * defeating the citation/§section retrieval the student-facing flow depends
 * on.
 *
 * Called by /api/admin/procedures/[id]/sop. On failure, the route falls
 * back to the raw text (preserving the previous behaviour) so a slow/down
 * GLM never blocks an admin from saving an SOP.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  StructureSopInputSchema,
  StructureSopOutputSchema,
  type StructureSopOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function structureSop(
  input: unknown,
  opts: { procedureId?: string | null } = {}
): Promise<StructureSopOutput> {
  const validated = StructureSopInputSchema.parse(input);
  const systemPrompt = loadPrompt("structure_sop");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    // glm-4.5-flash for finals stability — see generateBriefing.ts header.
    model: "glm-4.5-flash",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    // SOPs can be long. 6000 tokens leaves room for the entire structured
    // markdown of a 5-page procedure without truncating mid-section.
    maxTokens: 6000,
    temperature: 0.2,
    mockFixture: "structure_sop_generic",
  });

  const parsed = StructureSopOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.procedureId ?? null,
    endpoint: "structure_sop",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      raw_text_length: validated.rawText.length,
    },
    output: {
      markdown_length: parsed.markdown.length,
      h2_section_count: (parsed.markdown.match(/^## /gm) ?? []).length,
    },
    result,
  });

  return parsed;
}
