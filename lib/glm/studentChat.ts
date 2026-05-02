/**
 * studentChat — always-on AI helper for the student during their application.
 *
 * Grounded in the procedure's SOP excerpts, the student's profile, the
 * step they're currently on, the history of completed steps, and the most
 * recent chat turns. Returns a reply plus a `suggest_escalate` flag so the
 * UI can offer a one-click "Ask a coordinator" handoff.
 *
 * This call is independent of nextStep — it doesn't change the application's
 * progress; it just helps the student understand their situation.
 */

import { callGlm, hashPrompt } from "./client";
import { loadPrompt } from "./loadPrompt";
import {
  StudentChatInputSchema,
  StudentChatOutputSchema,
  type StudentChatOutput,
} from "./schemas";
import { writeTrace } from "./trace";

export async function studentChat(
  input: unknown,
  opts: { applicationId?: string | null } = {}
): Promise<StudentChatOutput> {
  const validated = StudentChatInputSchema.parse(input);
  const systemPrompt = loadPrompt("student_chat");
  const userPrompt = JSON.stringify(validated);

  // Pick a fixture based on a crude keyword match against the student's
  // message, so mock-mode demos can swing between the answer-and-resolve
  // path and the suggest-escalate path. Live mode ignores this.
  const escalateKeywords = [
    "coordinator", "human", "speak to someone", "stuck", "don't have",
    "dont have", "can't get", "cant get", "emergency", "i need help",
  ];
  const lower = validated.studentMessage.toLowerCase();
  const fixture = escalateKeywords.some((k) => lower.includes(k))
    ? "student_chat_escalate"
    : "student_chat_answer";

  const result = await callGlm({
    model: "glm-4.6",
    systemPrompt,
    userPrompt,
    jsonMode: true,
    maxTokens: 1500,
    temperature: 0.3,
    mockFixture: fixture,
  });

  const parsed = StudentChatOutputSchema.parse(JSON.parse(result.text));

  await writeTrace({
    workflowId: opts.applicationId ?? null,
    endpoint: "student_chat",
    promptHash: hashPrompt(systemPrompt),
    inputSummary: {
      message_length: validated.studentMessage.length,
      sop_chunk_count: validated.sopChunks.length,
      history_length: validated.history.length,
      recent_chat_turns: validated.recentChat.length,
    },
    output: {
      response_length: parsed.ai_response.length,
      suggest_escalate: parsed.suggest_escalate,
    },
    result,
  });

  return parsed;
}
