/**
 * routeDecision — at a decision node, GLM picks which branch to follow.
 *
 * Below confidence threshold (0.7), the API caller should surface a
 * disambiguation question to the user instead of advancing the workflow.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  RouteDecisionInputSchema,
  RouteDecisionOutputSchema,
  type RouteDecisionOutput,
} from "./schemas";
import { writeTrace } from "./trace";
import { verifyCitations } from "./citationVerifier";

export const ROUTE_DECISION_CONFIDENCE_THRESHOLD = 0.7;

export async function routeDecision(
  input: unknown,
  opts: { workflowId?: string | null } = {}
): Promise<RouteDecisionOutput> {
  const validated = RouteDecisionInputSchema.parse(input);
  const systemPrompt = loadPrompt("route");
  const userPrompt = JSON.stringify(validated);

  const result = await callGlm({
    model: "glm-4.6",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 800,
    temperature: 0.1,
    mockFixture: "route_eligibility_check",
  });

  let parsed = RouteDecisionOutputSchema.parse(JSON.parse(result.text));

  // Verify the selected_condition_key is a real branch.
  const validKeys = new Set(validated.decisionNode.branches.map((b) => b.condition_key));
  if (!validKeys.has(parsed.selected_condition_key)) {
    throw new Error(
      `routeDecision: GLM returned condition_key "${parsed.selected_condition_key}" not in branch list`
    );
  }

  // Verify citations against the KB. Strip any unverified citations.
  const verifiedCitations = await verifyCitations(parsed.citations);
  const allVerified = verifiedCitations.length === parsed.citations.length;
  parsed = { ...parsed, citations: verifiedCitations };

  await writeTrace({
    workflowId: opts.workflowId ?? null,
    endpoint: "route",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      decision_label: validated.decisionNode.label,
      branch_keys: [...validKeys],
      response_count: validated.priorResponses.length,
    },
    output: parsed,
    confidence: parsed.confidence,
    citations: parsed.citations,
    citationVerified: allVerified,
    result,
  });

  return parsed;
}
