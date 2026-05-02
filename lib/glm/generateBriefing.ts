/**
 * generateBriefing — produce the coordinator-side briefing for a submitted
 * application.
 *
 * v2 signature: input is the application's running history (all step prompts +
 * student responses). GLM digests it into facts + flags + recommendation.
 *
 * Provider routing: by default this runs on Z.AI GLM-4.6. When
 * USE_ILMU_FOR_BRIEFING=true, the same call is routed through ILMU's
 * ilmu-glm-5.1 (Malaysia-hosted sovereign model). Prompt + output schema
 * are shared — downstream parsing is provider-agnostic — so flipping the env
 * var is the only change needed. The briefing is the best candidate for MY
 * routing because it reads Malay-heavy step history and summarises it for a
 * local coordinator; keeping step-emission on GLM avoids regressions in the
 * student-facing path.
 */

import { callGlm, hashPrompt } from "./client";
import { callIlmu } from "../ilmu/client";
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

  const useIlmu = process.env.USE_ILMU_FOR_BRIEFING === "true";

  // Retry-on-validation-failure loop. Without this, a single GLM response
  // that's missing a required field (e.g. ai_confidence — observed in
  // production where ZERO `brief` traces were ever written despite many
  // submits) makes the whole call throw and the submit route falls back
  // to its placeholder briefing. The loop gives GLM one corrective attempt
  // with the validation error inlined into the prompt, mirroring the
  // pattern already proven in nextStep.ts.
  let parsed: GenerateBriefingOutput | null = null;
  let lastError: string | null = null;
  let retryCount = 0;
  let result: Awaited<ReturnType<typeof callGlm>>;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correctivePrompt =
      attempt === 0
        ? systemPrompt
        : `${systemPrompt}\n\nYour previous response failed validation: ${lastError}\nReturn ONLY valid JSON matching the schema, with EVERY required field present. Required fields: extracted_facts, flags, recommendation, ai_confidence, reasoning.`;

    result = useIlmu
      ? await callIlmu({
          model: "ilmu-glm-5.1",
          systemPrompt: correctivePrompt,
          userPrompt,
          jsonMode: true,
          // ILMU-GLM-5.1 spends more tokens on internal reasoning than Z.AI
          // GLM; 2500 leaves comfortable headroom for a 1.5k-token briefing
          // JSON without risking an empty-content response (observed at
          // max_tokens≤200).
          maxTokens: 2500,
          temperature: 0.2,
          mockFixture: "brief_scholarship_application",
        })
      : await callGlm({
          // Was glm-4.6 — switched to glm-4.5-flash on 2026-05-02 because
          // Z.AI GLM-4.6 latency has been spiking past Vercel's 60s function
          // ceiling for the finals demo. Flash is materially faster and the
          // briefing quality is acceptable for the demo. Revert when Z.AI
          // stabilises.
          model: "glm-4.5-flash",
          systemPrompt: correctivePrompt,
          userPrompt,
          jsonMode: true,
          maxTokens: 1500,
          temperature: 0.2,
          mockFixture: "brief_scholarship_application",
        });

    try {
      parsed = GenerateBriefingOutputSchema.parse(JSON.parse(result.text));
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retryCount++;
    }
  }

  if (!parsed) {
    throw new Error(`generateBriefing failed validation after retry: ${lastError}`);
  }

  await writeTrace({
    workflowId: opts.applicationId ?? null,
    endpoint: "brief",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      procedure: validated.procedureName,
      history_length: validated.history.length,
      sop_chunk_count: validated.sopChunks.length,
      // Provider tag so /admin/glm-traces can A/B latency + quality side by
      // side without widening the TraceEndpoint enum.
      provider: useIlmu ? "ilmu" : "glm",
    },
    output: { recommendation: parsed.recommendation, flag_count: parsed.flags.length },
    confidence: parsed.ai_confidence,
    result: result!,
    retryCount,
  });

  return parsed;
}
