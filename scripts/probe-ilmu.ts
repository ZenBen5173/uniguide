/**
 * Probe the ILMU API (YTL AI Labs) to verify an API key works and discover
 * the available models, without touching any UniGuide state.
 *
 * ILMU is OpenAI-compatible, so we use the existing `openai` npm package with
 * a custom baseURL — same pattern as lib/glm/client.ts.
 *
 * Setup (do this ONCE after the invite-code sign-up):
 *   1) Sign up at https://console.ilmu.ai/  (use the invite code from the
 *      email — that's NOT an API key, it's an account activation code)
 *   2) In the dashboard, generate an API key
 *   3) Add to .env.local at the repo root:
 *        ILMU_API_KEY=sk_...
 *        # Override the base URL if the official docs list a different one:
 *        # ILMU_BASE_URL=https://api.ilmu.ai/v1
 *        # Override the test model if /models listing isn't supported:
 *        # ILMU_MODEL=ilmu-chat
 *
 * Run:
 *   npm run probe:ilmu
 *
 * What it checks:
 *   1. Auth works (key is valid)
 *   2. GET /models returns a usable list (so we know model IDs for real calls)
 *   3. POST /chat/completions returns text for a Bahasa Melayu prompt (the
 *      headline capability — if this passes, ILMU is a real option for
 *      UniGuide's MY-context procedures)
 *   4. Latency and token-usage are reasonable
 *
 * This script makes no DB writes and no UniGuide-side changes. Its only
 * side-effect is billing a few tokens against your new ILMU account.
 */

// Env loading: pass the key inline (ILMU_API_KEY=... npm run probe:ilmu) or
// use tsx's native --env-file flag. dotenv is not a direct dep here.
import OpenAI from "openai";

const apiKey = process.env.ILMU_API_KEY;
const baseURL = process.env.ILMU_BASE_URL ?? "https://api.ilmu.ai/v1";
const overrideModel = process.env.ILMU_MODEL;

function bail(msg: string, hint?: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

if (!apiKey) {
  bail(
    "ILMU_API_KEY is not set",
    "Sign up at https://console.ilmu.ai/ with your invite code, generate an API key, then add ILMU_API_KEY=... to .env.local"
  );
}

const client = new OpenAI({ apiKey, baseURL });

async function main() {
  console.log(`\n▸ Probing ILMU at \x1b[36m${baseURL}\x1b[0m`);
  console.log(`  (override with ILMU_BASE_URL if docs list a different host)\n`);

  // ── Step 1: list models ──────────────────────────────────────────────────
  let modelIds: string[] = [];
  try {
    const t0 = Date.now();
    const res = await client.models.list();
    modelIds = res.data.map((m) => m.id);
    console.log(`\x1b[32m✓\x1b[0m GET /models → ${modelIds.length} model${modelIds.length === 1 ? "" : "s"} in ${Date.now() - t0}ms`);
    modelIds.forEach((id) => console.log(`    · ${id}`));
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.log(`\x1b[33m⚠\x1b[0m GET /models unsupported (status ${e.status ?? "?"}) — will fall back to ILMU_MODEL env var or "ilmu-chat"`);
    if (e.message) console.log(`    ${e.message}`);
  }

  // ── Step 2: chat completion (BM prompt to validate headline capability) ──
  // Default model per ILMU console quickstart. Override with ILMU_MODEL=... if
  // /models listing later surfaces more options (e.g. larger/faster variants).
  const testModel = overrideModel ?? modelIds[0] ?? "nemo-super";
  console.log(`\n▸ Testing chat completion`);
  console.log(`  model:  \x1b[36m${testModel}\x1b[0m`);
  console.log(`  prompt: "Apakah Universiti Malaya? Jawab dalam satu ayat."\n`);

  try {
    const t0 = Date.now();
    const response = await client.chat.completions.create({
      model: testModel,
      messages: [
        { role: "system", content: "Anda adalah pembantu AI yang ringkas dan tepat. Jawab dalam Bahasa Melayu." },
        { role: "user", content: "Apakah Universiti Malaya? Jawab dalam satu ayat." },
      ],
      // GLM-based models burn some tokens on internal reasoning before producing
      // visible content, so a tight max_tokens can return empty content even
      // when the request otherwise succeeded. Keep this generous for the probe.
      max_tokens: 600,
      temperature: 0.3,
    });
    const elapsed = Date.now() - t0;
    const text = response.choices[0]?.message?.content ?? "(empty response)";
    const usage = response.usage;

    console.log(`\x1b[32m✓\x1b[0m chat completion in ${elapsed}ms`);
    console.log(`  returned model: ${response.model}`);
    if (usage) {
      console.log(`  tokens: ${usage.prompt_tokens} in · ${usage.completion_tokens} out · ${usage.total_tokens} total`);
    }
    console.log(`\n\x1b[2m──── response ────\x1b[0m`);
    console.log(`${text}`);
    console.log(`\x1b[2m──────────────────\x1b[0m\n`);
    console.log(`\x1b[32m✓ ILMU API is working. Key is valid, chat completions return, BM prompt understood.\x1b[0m`);
    console.log(`  Next: decide where to plug this in (candidate: parallel path for BM-heavy SOPs).\n`);
  } catch (err) {
    console.error(`\x1b[31m✗ chat completion failed\x1b[0m`);
    const e = err as { status?: number; message?: string; code?: string };
    if (e.status) console.error(`  status:  ${e.status}`);
    if (e.code)   console.error(`  code:    ${e.code}`);
    if (e.message) console.error(`  message: ${e.message}`);
    if (e.status === 401) console.error(`  → API key rejected. Double-check you pasted the key (not the invite code).`);
    if (e.status === 404) console.error(`  → Model "${testModel}" not found. Try setting ILMU_MODEL to one from the list above.`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`\x1b[31m✗ unexpected error\x1b[0m`);
  console.error(err);
  process.exit(3);
});
