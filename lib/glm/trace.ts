/**
 * Reasoning trace writer.
 *
 * Every GLM call writes a row to glm_reasoning_trace. This is the audit log
 * judges and admins use to understand "what did the model decide and why".
 *
 * Failures to write a trace are logged but never block the user-facing call.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import type { GlmCallResult } from "./client";

export type TraceEndpoint =
  | "intent"
  | "plan"            // legacy (v1) — kept for trace history compatibility
  | "adapt"           // legacy
  | "route"           // legacy
  | "parse"
  | "brief"
  | "next_step"       // v2
  | "fill_letter"     // v2
  | "estimate_progress" // v2
  | "coassist"        // coordinator natural-language artifact revision
  | "student_chat";   // always-on student AI helper

export interface TraceRecord {
  workflowId: string | null;
  endpoint: TraceEndpoint;
  promptHash: string;
  inputSummary: Record<string, unknown>;
  output: unknown;
  confidence?: number;
  citations?: string[];
  citationVerified?: boolean;
  result: GlmCallResult;
  retryCount?: number;
}

export async function writeTrace(record: TraceRecord): Promise<void> {
  try {
    // Service role bypasses RLS — reasoning trace is server-side audit only.
    const supabase = getServiceSupabase();
    await supabase.from("glm_reasoning_trace").insert({
      workflow_id: record.workflowId,
      endpoint: record.endpoint,
      model_version: record.result.model,
      prompt_hash: record.promptHash,
      input_summary: record.inputSummary,
      output: record.output,
      confidence: record.confidence ?? null,
      citations: record.citations ?? [],
      citation_verified: record.citationVerified ?? true,
      input_tokens: record.result.inputTokens,
      output_tokens: record.result.outputTokens,
      latency_ms: record.result.latencyMs,
      cache_hit: record.result.cacheHit,
      retry_count: record.retryCount ?? 0,
    });
  } catch (err) {
    // Don't throw — trace failures must not block the user-facing flow.
    console.error("[trace:write_failed]", err);
  }
}
