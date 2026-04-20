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

  // Could also enrich with parsed_attachments via attachments table; deferred.
  return (steps ?? []).map((s) => ({
    ordinal: s.ordinal,
    type: s.type as StepType,
    prompt_text: s.prompt_text,
    emitted_by: (s.emitted_by as "ai" | "coordinator") ?? "ai",
    response_data: s.response_data,
  }));
}

/**
 * Emit the next step for an application.
 * If GLM signals is_complete=true, returns { complete: true, step: null }.
 * Otherwise inserts the new step row and returns it.
 *
 * `coordinatorRequest` is set when a coordinator typed "request more info".
 */
export async function emitNextStep(args: {
  applicationId: string;
  coordinatorRequest?: string | null;
}): Promise<
  | { complete: true; step: null }
  | { complete: false; step: { id: string; ordinal: number; type: StepType; prompt_text: string; config: Record<string, unknown> } }
> {
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

  const sb = getServiceSupabase();
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
 * Returns the next step OR signals completion.
 */
export async function recordResponseAndAdvance(args: {
  applicationId: string;
  stepId: string;
  responseData: Record<string, unknown>;
}): Promise<
  | { complete: true; step: null }
  | { complete: false; step: { id: string; ordinal: number; type: StepType; prompt_text: string; config: Record<string, unknown> } }
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

  // Bump progress counter.
  const { data: completedCount } = await sb
    .from("application_steps")
    .select("id", { count: "exact", head: true })
    .eq("application_id", args.applicationId)
    .eq("status", "completed");
  if (completedCount !== null) {
    await sb
      .from("applications")
      .update({ progress_current_step: (completedCount as unknown as number) || 0 })
      .eq("id", args.applicationId);
  }

  return emitNextStep({ applicationId: args.applicationId });
}
