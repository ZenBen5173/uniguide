/**
 * The application engine — the core "advance an application" logic.
 *
 * Replaces the old workflow stage engine. Much simpler under v2:
 *   - Build history from completed steps
 *   - Call nextStep
 *   - If is_complete=true, mark application ready for submit
 *   - Otherwise, insert the new step row
 *
 * No stages, no edges, no decision nodes. Just an ordered list of steps.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import { nextStep } from "@/lib/glm/nextStep";
import type { HistoryStep, StepType } from "@/lib/glm/schemas";
import { retrieveProcedureSop } from "@/lib/kb/retrieve";

export interface ApplicationContext {
  application: {
    id: string;
    user_id: string;
    procedure_id: string;
    status: string;
    progress_current_step: number;
    progress_estimated_total: number | null;
  };
  procedure: { id: string; name: string };
  studentProfile: {
    full_name: string | null;
    faculty: string | null;
    programme: string | null;
    year: number | null;
    cgpa: number | null;
    citizenship: string;
  };
}

export async function loadApplicationContext(
  applicationId: string
): Promise<ApplicationContext | null> {
  const sb = getServiceSupabase();
  const { data: app } = await sb
    .from("applications")
    .select("id, user_id, procedure_id, status, progress_current_step, progress_estimated_total")
    .eq("id", applicationId)
    .single();
  if (!app) return null;

  const [{ data: procedure }, { data: profile }] = await Promise.all([
    sb.from("procedures").select("id, name").eq("id", app.procedure_id).single(),
    sb.from("student_profiles").select("full_name, faculty, programme, year, cgpa, citizenship").eq("user_id", app.user_id).single(),
  ]);

  if (!procedure) return null;

  return {
    application: app,
    procedure,
    studentProfile: profile ?? {
      full_name: null,
      faculty: null,
      programme: null,
      year: null,
      cgpa: null,
      citizenship: "MY",
    },
  };
}

/** Build the history payload from this application's completed steps. */
export async function buildHistory(applicationId: string): Promise<HistoryStep[]> {
  const sb = getServiceSupabase();
  const { data: steps } = await sb
    .from("application_steps")
    .select("ordinal, type, prompt_text, emitted_by, response_data, status")
    .eq("application_id", applicationId)
    .eq("status", "completed")
    .order("ordinal");

  return (steps ?? []).map((s) => {
    const rd = (s.response_data ?? {}) as Record<string, unknown>;
    // If the /respond pipeline ran parseDocument inline on this step's upload,
    // surface the structured fields as parsed_attachments so the AI can rely on
    // them and avoid re-asking the student for facts already in the document.
    const filename = rd.filename as string | undefined;
    const extracted = rd.extracted_fields as Record<string, unknown> | undefined;
    const parsed_attachments =
      filename && extracted
        ? [{ filename, extracted_fields: extracted }]
        : undefined;
    return {
      ordinal: s.ordinal,
      type: s.type as StepType,
      prompt_text: s.prompt_text,
      emitted_by: (s.emitted_by as "ai" | "coordinator") ?? "ai",
      response_data: s.response_data,
      ...(parsed_attachments ? { parsed_attachments } : {}),
    };
  });
}

/** Shape returned by previewNextStep — what the AI proposes, without inserting. */
export interface ProposedStep {
  type: StepType;
  prompt_text: string;
  config: Record<string, unknown>;
  reasoning: string;
  citations: string[];
}

/** Optional override that bypasses the GLM call and inserts verbatim. */
export interface StepOverride {
  type: StepType;
  prompt_text: string;
  config: Record<string, unknown>;
}

/**
 * Plan a next step WITHOUT committing it. Used by the coordinator's
 * preview-step modal: shows the AI's proposed question (and reasoning)
 * so the coordinator can confirm or edit before it reaches the student.
 *
 * Mirrors emitNextStep's preconditions; just skips the DB insert.
 * Returns null when GLM signals is_complete=true (nothing more to ask).
 */
export async function previewNextStep(args: {
  applicationId: string;
  coordinatorRequest?: string | null;
}): Promise<ProposedStep | null> {
  const ctx = await loadApplicationContext(args.applicationId);
  if (!ctx) throw new Error(`Application ${args.applicationId} not found`);

  const [history, sopChunks] = await Promise.all([
    buildHistory(args.applicationId),
    retrieveProcedureSop(ctx.procedure.id),
  ]);

  const result = await nextStep(
    {
      procedureId: ctx.procedure.id as never,
      procedureName: ctx.procedure.name,
      studentProfile: ctx.studentProfile,
      sopChunks,
      history,
      coordinatorRequest: args.coordinatorRequest ?? null,
    },
    { applicationId: args.applicationId }
  );

  if (result.is_complete || !result.next_step) return null;

  const config = {
    ...result.next_step.config,
    ...(result.citations && result.citations.length > 0
      ? { citations: result.citations }
      : {}),
  };

  return {
    type: result.next_step.type,
    prompt_text: result.next_step.prompt_text,
    config,
    reasoning: result.reasoning,
    citations: result.citations,
  };
}

/**
 * Emit the next step for an application.
 * If GLM signals is_complete=true, returns { complete: true, step: null }.
 * Otherwise inserts the new step row and returns it.
 *
 * `coordinatorRequest` is set when a coordinator typed "request more info".
 * `stepOverride` is set when a coordinator confirmed an AI-proposed step in
 *   the preview-step modal — skips the GLM call entirely and inserts verbatim.
 */
export async function emitNextStep(args: {
  applicationId: string;
  coordinatorRequest?: string | null;
  stepOverride?: StepOverride | null;
}): Promise<
  | { complete: true; step: null }
  | { complete: false; step: { id: string; ordinal: number; type: StepType; prompt_text: string; config: Record<string, unknown> } }
> {
  const sb = getServiceSupabase();

  // Coordinator-confirmed override path — bypasses the AI call entirely.
  // Used after a Request-More-Info preview where the coordinator already
  // saw and confirmed (possibly edited) the AI's proposed step.
  if (args.stepOverride) {
    const ctx = await loadApplicationContext(args.applicationId);
    if (!ctx) throw new Error(`Application ${args.applicationId} not found`);
    const history = await buildHistory(args.applicationId);
    const nextOrdinal = (history.length || 0) + 1;

    const { data: inserted, error } = await sb
      .from("application_steps")
      .insert({
        application_id: args.applicationId,
        ordinal: nextOrdinal,
        type: args.stepOverride.type,
        prompt_text: args.stepOverride.prompt_text,
        config: args.stepOverride.config,
        // If the override originated from a coordinator request, mark accordingly
        // so the student UI can show "from your coordinator" attribution.
        emitted_by: "coordinator",
        status: "pending",
      })
      .select("id, ordinal, type, prompt_text, config")
      .single();

    if (error || !inserted) {
      throw new Error(`Failed to insert override step: ${error?.message}`);
    }

    return {
      complete: false,
      step: {
        id: inserted.id,
        ordinal: inserted.ordinal,
        type: inserted.type as StepType,
        prompt_text: inserted.prompt_text,
        config: inserted.config as Record<string, unknown>,
      },
    };
  }

  const ctx = await loadApplicationContext(args.applicationId);
  if (!ctx) throw new Error(`Application ${args.applicationId} not found`);

  const history = await buildHistory(args.applicationId);
  const sopChunks = await retrieveProcedureSop(ctx.procedure.id);

  const result = await nextStep(
    {
      procedureId: ctx.procedure.id as never,
      procedureName: ctx.procedure.name,
      studentProfile: ctx.studentProfile,
      sopChunks,
      history,
      coordinatorRequest: args.coordinatorRequest ?? null,
    },
    { applicationId: args.applicationId }
  );

  if (result.is_complete || !result.next_step) {
    return { complete: true, step: null };
  }

  const nextOrdinal = (history.length || 0) + 1;

  // Embed AI's SOP citations into the step config so the student-facing UI
  // can show "based on §X of UM SOP" chips next to the step.
  const configWithCitations = {
    ...result.next_step.config,
    ...(result.citations && result.citations.length > 0 ? { citations: result.citations } : {}),
  };

  const { data: inserted, error } = await sb
    .from("application_steps")
    .insert({
      application_id: args.applicationId,
      ordinal: nextOrdinal,
      type: result.next_step.type,
      prompt_text: result.next_step.prompt_text,
      config: configWithCitations,
      emitted_by: args.coordinatorRequest ? "coordinator" : "ai",
      status: "pending",
    })
    .select("id, ordinal, type, prompt_text, config")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to insert next step: ${error?.message}`);
  }

  // Update application's running summary on the row for inbox display.
  if (result.running_summary) {
    await sb
      .from("applications")
      .update({ student_summary: result.running_summary })
      .eq("id", args.applicationId);
  }

  return {
    complete: false,
    step: {
      id: inserted.id,
      ordinal: inserted.ordinal,
      type: inserted.type as StepType,
      prompt_text: inserted.prompt_text,
      config: inserted.config as Record<string, unknown>,
    },
  };
}

/**
 * Record a step response and trigger the next step.
 *
 * Returns the next step OR signals completion OR (if the AI's nextStep call
 * fails / times out) signals `stuck: true` so the caller knows the response
 * was saved but no follow-up step was emitted. The student can then click
 * "Resume" to retry — see /api/applications/[id]/emit-next.
 *
 * Historically this threw when emitNextStep failed, leaving the application
 * in a half-saved state with the step marked completed but no pending step.
 * Thevesh's scholarship app got stuck in exactly this state on 2 May 2026.
 */
export async function recordResponseAndAdvance(args: {
  applicationId: string;
  stepId: string;
  responseData: Record<string, unknown>;
}): Promise<
  | { complete: true; step: null; stuck?: false }
  | { complete: false; step: { id: string; ordinal: number; type: StepType; prompt_text: string; config: Record<string, unknown> }; stuck?: false }
  | { complete: false; step: null; stuck: true; error: string }
> {
  const sb = getServiceSupabase();

  // Mark the step completed.
  const { error: respErr } = await sb
    .from("application_steps")
    .update({
      status: "completed",
      response_data: args.responseData,
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.stepId)
    .eq("application_id", args.applicationId);
  if (respErr) throw new Error(`Failed to record response: ${respErr.message}`);

  // Bump progress counter. With head:true the count lives on the `count`
  // property of the response, not `data` — destructuring `data` here
  // historically left `progress_current_step` stuck at 0 (see Portal's
  // progress bar). Read both, then pick whichever we got.
  const { count: completedCount } = await sb
    .from("application_steps")
    .select("id", { count: "exact", head: true })
    .eq("application_id", args.applicationId)
    .eq("status", "completed");
  if (typeof completedCount === "number") {
    await sb
      .from("applications")
      .update({ progress_current_step: completedCount })
      .eq("id", args.applicationId);
  }

  try {
    return await emitNextStep({ applicationId: args.applicationId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[engine] emitNextStep failed after step recorded:", msg);
    return { complete: false, step: null, stuck: true, error: msg };
  }
}
