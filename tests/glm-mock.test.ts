/**
 * Smoke tests for the GLM + ILMU mock-mode paths.
 *
 * These tests exist to catch regressions in the demo resilience story —
 * specifically that:
 *   1. callGlm in GLM_MOCK_MODE returns canned fixture text.
 *   2. callIlmu in ILMU_MOCK_MODE returns the same fixture (shared format).
 *   3. Missing fixture names produce a clear error rather than silent empty
 *      responses (downstream JSON.parse would otherwise fail mysteriously).
 *
 * Run via `npm test`. No live API key is required.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { callGlm } from "../lib/glm/client";
import { callIlmu } from "../lib/ilmu/client";

describe("GLM mock-mode", () => {
  beforeEach(() => {
    process.env.GLM_MOCK_MODE = "true";
    process.env.ZAI_API_KEY = "";
  });

  it("returns the canned fixture for a known mockFixture name", async () => {
    const result = await callGlm({
      model: "glm-4.6",
      systemPrompt: "test system",
      userPrompt: "test user",
      mockFixture: "brief_scholarship_application",
    });

    expect(result.mocked).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
    expect(() => JSON.parse(result.text)).not.toThrow();

    const parsed = JSON.parse(result.text);
    expect(parsed).toHaveProperty("recommendation");
  });

  it("throws a clear error when mockFixture is missing in mock mode", async () => {
    await expect(
      callGlm({
        model: "glm-4.6",
        systemPrompt: "x",
        userPrompt: "y",
        // no mockFixture
      })
    ).rejects.toThrow(/mockFixture/);
  });

  it("throws a clear error when mockFixture name doesn't exist on disk", async () => {
    await expect(
      callGlm({
        model: "glm-4.6",
        systemPrompt: "x",
        userPrompt: "y",
        mockFixture: "this_fixture_does_not_exist",
      })
    ).rejects.toThrow(/Fixture not found/);
  });
});

describe("ILMU mock-mode", () => {
  beforeEach(() => {
    process.env.ILMU_MOCK_MODE = "true";
    process.env.ILMU_API_KEY = "";
  });

  it("falls back to GLM fixtures (shared format) when no key is set", async () => {
    const result = await callIlmu({
      model: "ilmu-glm-5.1",
      systemPrompt: "test",
      userPrompt: "test",
      mockFixture: "brief_scholarship_application",
    });

    expect(result.mocked).toBe(true);
    expect(result.model).toContain("ilmu-glm-5.1");
    expect(result.text.length).toBeGreaterThan(0);
    expect(() => JSON.parse(result.text)).not.toThrow();
  });
});
