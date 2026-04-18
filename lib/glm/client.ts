/**
 * Z.AI GLM client wrapper.
 *
 * Z.AI's GLM API is OpenAI-compatible at https://api.z.ai/api/paas/v4/, so we
 * use the `openai` npm package with a custom baseURL.
 *
 * Mock mode: when ZAI_API_KEY is empty OR GLM_MOCK_MODE=true, the client
 * returns canned fixtures from tests/fixtures/glm/. This lets the app run
 * end-to-end without a live API key during development.
 */

import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";

export type GlmModel =
  | "glm-4.6"
  | "glm-4.5-flash";

export interface GlmCallOptions {
  model: GlmModel;
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Identifier of the canned fixture to return when in mock mode. */
  mockFixture?: string;
}

export interface GlmCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
  cacheHit: boolean;
  mocked: boolean;
}

const isMockMode = (): boolean => {
  if (process.env.GLM_MOCK_MODE === "true") return true;
  if (process.env.GLM_MOCK_MODE === "false") return false;
  return !process.env.ZAI_API_KEY;
};

let _client: OpenAI | null = null;
const getClient = (): OpenAI => {
  if (_client) return _client;
  _client = new OpenAI({
    apiKey: process.env.ZAI_API_KEY ?? "mock-key",
    baseURL: process.env.ZAI_API_BASE_URL ?? "https://api.z.ai/api/paas/v4",
  });
  return _client;
};

/**
 * Load a canned response from tests/fixtures/glm/<name>.json.
 * Returns the .text field which should already be the JSON string a real
 * GLM call would produce in JSON mode.
 */
const loadFixture = (name: string): string => {
  const path = join(process.cwd(), "tests", "fixtures", "glm", `${name}.json`);
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.text === "string") return parsed.text;
    return JSON.stringify(parsed);
  } catch (err) {
    throw new Error(
      `[glm:mock] Fixture not found: ${path}. ` +
        `Either create the fixture or set GLM_MOCK_MODE=false with a real ZAI_API_KEY.`
    );
  }
};

/**
 * Single entry point for any GLM completion call. All endpoints in lib/glm/*
 * funnel through this. Centralised here so retry, mock, and trace concerns
 * have one place to live.
 */
export async function callGlm(opts: GlmCallOptions): Promise<GlmCallResult> {
  const start = Date.now();
  const mocked = isMockMode();

  if (mocked) {
    if (!opts.mockFixture) {
      throw new Error(
        `[glm:mock] Mock mode active but no mockFixture provided for this call. ` +
          `Add a fixture name or set GLM_MOCK_MODE=false.`
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
    max_tokens: opts.maxTokens ?? 2000,
    temperature: opts.temperature ?? 0.2,
    ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const response = await client.chat.completions.create(params);

  // OpenAI-compatible streaming would require a different code path; for now
  // we use blocking completions which is fine for our latency budget.
  const choice = "choices" in response ? response.choices?.[0] : null;
  const text = choice?.message?.content ?? "";

  return {
    text,
    inputTokens: ("usage" in response && response.usage?.prompt_tokens) || 0,
    outputTokens: ("usage" in response && response.usage?.completion_tokens) || 0,
    latencyMs: Date.now() - start,
    model: opts.model,
    cacheHit: false,
    mocked: false,
  };
}

/**
 * Hash a prompt for the reasoning-trace table.
 * We only store the hash (not the prompt itself) so prompt-engineering
 * iterations don't bloat the audit table — but you can always look up the
 * prompt by hash in the versioned `lib/glm/prompts/` directory.
 */
export function hashPrompt(prompt: string): string {
  // Cheap non-crypto hash — good enough for a non-security audit identifier.
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = (hash << 5) - hash + prompt.charCodeAt(i);
    hash |= 0;
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
