/**
 * nextStep — the heart of UniGuide v2.
 *
 * Given an application's running history (all completed steps and responses)
 * plus the procedure's SOP, GLM emits the next step OR signals the application
 * is complete.
 *
 * This endpoint runs every time:
 *   - A new application is created (history=[], emit Step 1)
 *   - A student completes a step (history grows by one, emit next)
 *   - A coordinator types "request more info" (coordinatorRequest is set)
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  NextStepInputSchema,
  NextStepOutputSchema,
  type NextStepInput,
  type NextStepOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function nextStep(
  input: NextStepInput,
  opts: { applicationId?: string | null; workflowId?: string | null } = {}
): Promise<NextStepOutput> {
  const validated = NextStepInputSchema.parse(input);
  const systemPrompt = loadPrompt("next_step");

  const userPrompt = JSON.stringify({
    procedureId: validated.procedureId,
    procedureName: validated.procedureName,
    studentProfile: validated.studentProfile,
    sopExcerpts: validated.sopChunks,
    history: validated.history,
    coordinatorRequest: validated.coordinatorRequest,
  });

  let parsed: NextStepOutput | null = null;
  let lastError: string | null = null;
  let retryCount = 0;
  let result: Awaited<ReturnType<typeof callGlm>>;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctivePrompt =
      attempt === 0
        ? systemPrompt
        : `${systemPrompt}\n\nYour previous response failed validation: ${lastError}\nReturn ONLY valid JSON matching the schema.`;

    result = await callGlm({
      // glm-4.5-flash for finals stability — see generateBriefing.ts header.
      model: "glm-4.5-flash",
      systemPrompt: correctivePrompt,
      userPrompt,
      jsonMode: true,
      maxTokens: 1500,
      temperature: 0.2,
      mockFixture: pickFixture(validated),
    });

    try {
      const candidate = NextStepOutputSchema.parse(JSON.parse(result.text));
      // Sanity: if is_complete=true, next_step must be null (and vice versa).
      if (candidate.is_complete && candidate.next_step !== null) {
        lastError = "is_complete=true requires next_step=null";
        retryCount++;
        continue;
      }
      if (!candidate.is_complete && candidate.next_step === null) {
        lastError = "is_complete=false requires next_step != null";
        retryCount++;
        continue;
      }
      parsed = candidate;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retryCount++;
    }
  }

  if (!parsed) {
    throw new Error(`nextStep failed validation after retry: ${lastError}`);
  }

  await writeTrace({
    workflowId: opts.applicationId ?? opts.workflowId ?? null,
    endpoint: "next_step",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      procedureId: validated.procedureId,
      history_length: validated.history.length,
      has_coordinator_request: !!validated.coordinatorRequest,
    },
    output: {
      is_complete: parsed.is_complete,
      next_step_type: parsed.next_step?.type ?? null,
    },
    citations: parsed.citations,
    result: result!,
    retryCount,
  });

  return parsed;
}

/**
 * Heuristic for mock-mode fixture selection — picks a fixture based on
 * how many steps have been completed and whether a coordinator request
 * is pending. Live mode ignores this entirely.
 */
function pickFixture(input: NextStepInput): string {
  if (input.coordinatorRequest) return "next_step_coordinator_request";
  const n = input.history.length;
  const proc = input.procedureId;
  if (proc === "scholarship_application") {
    if (n === 0) return "next_step_scholarship_1_intake";
    if (n === 1) return "next_step_scholarship_2_income_proof";
    if (n === 2) return "next_step_scholarship_3_pick_scholarships";
    if (n === 3) return "next_step_scholarship_4_motivation";
    if (n === 4) return "next_step_scholarship_5_review";
    return "next_step_scholarship_6_complete";
  }
  if (proc === "final_year_project") {
    if (n === 0) return "next_step_fyp_1_intake";
    if (n === 1) return "next_step_fyp_2_supervisor";
    if (n === 2) return "next_step_fyp_3_ethics";
    if (n === 3) return "next_step_fyp_4_review";
    return "next_step_generic_complete";
  }
  if (proc === "deferment_of_studies") {
    if (n === 0) return "next_step_deferment_1_reason";
    if (n === 1) return "next_step_deferment_2_proof";
    if (n === 2) return "next_step_deferment_3_review";
    return "next_step_generic_complete";
  }
  return "next_step_generic_complete";
}
