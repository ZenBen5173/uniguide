/**
 * structureTemplate — convert a one-off filled letter (e.g. extracted from a
 * Word doc the admin uploaded) into a reusable template by replacing
 * variable bits with `{{placeholder_name}}` substitutions that fillLetter
 * recognises at decision time.
 *
 * Why this exists: previously the /letter-templates endpoint detected
 * placeholders via a literal `\{\{...\}\}` regex. If the admin uploaded a
 * letter that had hardcoded "Dear Aishah binti Razak / CGPA 3.45" instead
 * of `{{full_name}} / {{cgpa}}`, no placeholders were detected and
 * fillLetter would emit broken letters with one student's data on every
 * other student's notice.
 *
 * Called by /api/admin/procedures/[id]/letter-templates. On failure, the
 * route falls back to the raw text + regex-only placeholder detection
 * (the previous behaviour).
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  StructureTemplateInputSchema,
  StructureTemplateOutputSchema,
  type StructureTemplateOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function structureTemplate(
  input: unknown,
  opts: { procedureId?: string | null } = {}
): Promise<StructureTemplateOutput> {
  const validated = StructureTemplateInputSchema.parse(input);
  const systemPrompt = loadPrompt("structure_template");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    // glm-4.5-flash for finals stability — see generateBriefing.ts header.
    model: "glm-4.5-flash",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    // Letters are typically <2000 tokens; cap generously for the JSON wrapper.
    maxTokens: 4000,
    temperature: 0.1,
    mockFixture: "structure_template_generic",
  });

  const parsed = StructureTemplateOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.procedureId ?? null,
    endpoint: "structure_template",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      raw_text_length: validated.rawText.length,
      template_type: validated.templateType,
    },
    output: {
      template_length: parsed.template_text.length,
      placeholder_count: parsed.detected_placeholders.length,
    },
    result,
  });

  return parsed;
}
