/**
 * ILMU API client wrapper (YTL AI Labs + Universiti Malaya).
 *
 * ILMU is Malaysia's sovereign multimodal LLM, exposed via an OpenAI-compatible
 * HTTPS API at https://api.ilmu.ai/v1, so we reuse the `openai` npm package
 * with a custom baseURL — same pattern as lib/glm/client.ts.
 *
 * Why a separate client: ILMU lives on a different model catalogue + billing
 * plan, and its GLM-5.1 backbone needs a different max_tokens ceiling than
 * Z.AI's standalone GLM because of internal reasoning-token overhead. Keeping
 * the two wrappers side-by-side (same result shape) makes it cheap to route
 * specific endpoints through whichever provider is a better fit.
 *
 * Current usage: UniGuide routes the coordinator briefing through ILMU when
 * USE_ILMU_FOR_BRIEFING=true, because the briefing digests Malay-heavy
 * application history into structured facts + flags — ILMU's MY-language
 * strength maps directly to that job.
 *
 * Mock mode: when ILMU_API_KEY is empty OR ILMU_MOCK_MODE=true, this client
 * returns canned fixtures from tests/fixtures/glm/ (same fixtures as GLM,
 * because the downstream JSON schemas are identical). Keeps the app runnable
 * when the ILMU hackathon token pool runs out.
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";
import type { GlmCallResult } from "../glm/client";

export type IlmuModel = "ilmu-glm-5.1";

export interface IlmuCallOptions {
  model: IlmuModel;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Identifier of the canned fixture to return when in mock/fallback mode. */
  mockFixture?: string;
}

const isMockMode = (): boolean => {
  if (process.env.ILMU_MOCK_MODE === "true") return true;
  if (process.env.ILMU_MOCK_MODE === "false") return false;
  return !process.env.ILMU_API_KEY;
};

let _client: OpenAI | null = null;
const getClient = (): OpenAI => {
  if (_client) return _client;
  _client = new OpenAI({
    apiKey: process.env.ILMU_API_KEY ?? "mock-key",
    baseURL: process.env.ILMU_API_BASE_URL ?? "https://api.ilmu.ai/v1",
  });
  return _client;
};

/**
 * Strip a markdown code fence (```json ... ``` or ``` ... ```) wrapping a JSON
 * payload. ILMU-GLM-5.1 consistently fences its JSON-mode output, unlike Z.AI
 * GLM. Safe on un-fenced strings (returns them trimmed).
 */
function unwrapJsonFence(s: string): string {
  const trimmed = s.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

/**
 * Fixtures are shared with the GLM client: downstream callers expect the same
 * JSON output schema regardless of provider, so a single canned response can
 * stand in for either.
 */
const loadFixture = (name: string): string => {
  const path = join(process.cwd(), "tests", "fixtures", "glm", `${name}.json`);
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.text === "string") return parsed.text;
    return JSON.stringify(parsed);
  } catch {
    throw new Error(
      `[ilmu:mock] Fixture not found: ${path}. ` +
        `Either create the fixture or set ILMU_MOCK_MODE=false with a real ILMU_API_KEY.`
    );
  }
};

/**
 * Single entry point for any ILMU completion. Mirrors callGlm() so callers can
 * swap providers with a one-line change — the GlmCallResult shape is shared.
 */
export async function callIlmu(opts: IlmuCallOptions): Promise<GlmCallResult> {
  const start = Date.now();
  const mocked = isMockMode();

  if (mocked) {
    if (!opts.mockFixture) {
      throw new Error(
        `[ilmu:mock] Mock mode active but no mockFixture provided for this call. ` +
          `Add a fixture name or set ILMU_MOCK_MODE=false.`
      );
    }
    const text = loadFixture(opts.mockFixture);
    return {
      text,
      inputTokens: Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4),
      outputTokens: Math.ceil(text.length / 4),
      latencyMs: Date.now() - start,
      model: `${opts.model}-mock`,
      cacheHit: false,
      mocked: true,
    };
  }

  const client = getClient();

  const params: ChatCompletionCreateParams = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userPrompt },
    ],
    // ILMU-GLM-5.1 burns a nontrivial chunk of the output budget on internal
    // reasoning tokens before emitting visible content. A probe run with
    // max_tokens=150 returned finish_reason=stop but empty content; at 600 it
    // produced a full multi-sentence Bahasa Melayu response. Default high to
    // avoid silent empty returns — callers can still override.
    max_tokens: opts.maxTokens ?? 2500,
    temperature: opts.temperature ?? 0.2,
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  try {
    const response = await client.chat.completions.create(params);
    const choice = "choices" in response ? response.choices?.[0] : null;
    const rawText = choice?.message?.content ?? "";
    // ILMU-GLM-5.1 wraps JSON-mode output in ```json ... ``` fences even when
    // response_format=json_object is requested. Strip the fence here so callers
    // can JSON.parse(result.text) without knowing which provider served it.
    const text = opts.jsonMode ? unwrapJsonFence(rawText) : rawText;

    return {
      text,
      inputTokens: ("usage" in response && response.usage?.prompt_tokens) || 0,
      outputTokens: ("usage" in response && response.usage?.completion_tokens) || 0,
      latencyMs: Date.now() - start,
      model: opts.model,
      cacheHit: false,
      mocked: false,
    };
  } catch (err) {
    // Auto-fallback: if ILMU errors (rate limit, transient 5xx, key expired)
    // AND a fixture exists, serve the fixture. Same resilience story as GLM —
    // a broken live provider should never take down the demo.
    if (opts.mockFixture) {
      console.error(
        `[ilmu:auto-fallback] live call failed (${err instanceof Error ? err.message : "unknown"}) — using fixture ${opts.mockFixture}`
      );
      try {
        const text = loadFixture(opts.mockFixture);
        return {
          text,
          inputTokens: Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4),
          outputTokens: Math.ceil(text.length / 4),
          latencyMs: Date.now() - start,
          model: `${opts.model}-fallback`,
          cacheHit: false,
          mocked: true,
        };
      } catch {
        // fixture missing too — re-throw original error
      }
    }
    throw err;
  }
}
