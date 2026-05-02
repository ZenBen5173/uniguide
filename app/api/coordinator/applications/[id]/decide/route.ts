/**
 * POST /api/coordinator/applications/[id]/decide
 *
 * Body: { decision: "approve" | "reject" | "request_info", comment?: string }
 *
 * - Approve / Reject: writes decision + flips application status; runs fillLetter
 *   against the matching template + creates application_letters row.
 * - Request more info: writes decision + flips status to 'more_info_requested';
 *   runs nextStep with coordinatorRequest=comment to emit a new step into the
 *   student's flow asking for the requested info.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { fillLetter } from "@/lib/glm/fillLetter";
import { emitNextStep, loadApplicationContext, buildHistory } from "@/lib/applications/engine";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const StepOverrideSchema = z.object({
  type: z.enum([
    "form",
    "file_upload",
    "text",
    "select",
    "multiselect",
    "info",
    "final_submit",
    "coordinator_message",
  ]),
  prompt_text: z.string().min(1).max(2000),
  config: z.record(z.string(), z.unknown()).default({}),
});

const Body = z.object({
  decision: z.enum(["approve", "reject", "request_info"]),
  comment: z.string().max(2000).optional(),
  /** If set, this exact text is used as the letter (skip GLM regen). Set when
   *  the coordinator previewed and edited the letter before sending. */
  letter_text_override: z.string().max(20000).optional(),
  /** If set on a request_info decision, skip the AI nextStep call and
   *  insert this exact step instead. Set when the coordinator previewed
   *  and confirmed (or edited) the AI's proposed step in the modal. */
  step_override: StepOverrideSchema.optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const sb = getServiceSupabase();

  const { data: app } = await sb
    .from("applications")
    .select("id, user_id, procedure_id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (!["submitted", "more_info_requested", "under_review"].includes(app.status)) {
    return apiError(`Application is ${app.status} — cannot decide`, 409);
  }

  // Get the latest pending briefing (for audit linkage).
  const { data: briefing } = await sb
    .from("application_briefings")
    .select("id")
    .eq("application_id", applicationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Insert decision
  await sb.from("application_decisions").insert({
    application_id: applicationId,
    briefing_id: briefing?.id ?? null,
    decided_by: user.id,
    decision: parsed.data.decision,
    comment: parsed.data.comment ?? null,
  });

  // Mark briefing resolved if present
  if (briefing) {
    await sb.from("application_briefings").update({ status: "resolved" }).eq("id", briefing.id);
  }

  // Branch on decision
  if (parsed.data.decision === "request_info") {
    const requestText =
      parsed.data.comment ??
      "The reviewer has requested additional information. Please respond.";

    // If the coordinator confirmed an AI-proposed step in the preview-step
    // modal, insert it verbatim (skipping a second nextStep GLM call). When
    // there's no override, fall back to the original behaviour: AI plans the
    // step inline. Backwards-compatible for any non-UI caller hitting /decide
    // without preview.
    const result = await emitNextStep({
      applicationId,
      coordinatorRequest: requestText,
      stepOverride: parsed.data.step_override
        ? {
            type: parsed.data.step_override.type as never,
            prompt_text: parsed.data.step_override.prompt_text,
            config: parsed.data.step_override.config,
          }
        : null,
    });

    await sb
      .from("applications")
      .update({ status: "more_info_requested", updated_at: new Date().toISOString() })
      .eq("id", applicationId);

    return apiSuccess({
      decided: true,
      kind: "request_info",
      next_step: result.complete ? null : result.step,
      step_override_used: !!parsed.data.step_override,
    });
  }

  // Approve OR Reject — fill the letter template.
  const newStatus = parsed.data.decision === "approve" ? "approved" : "rejected";
  const templateType = parsed.data.decision === "approve" ? "acceptance" : "rejection";

  const { data: template } = await sb
    .from("procedure_letter_templates")
    .select("id, name, template_text, detected_placeholders")
    .eq("procedure_id", app.procedure_id)
    .eq("template_type", templateType)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let letterRowId: string | null = null;

  if (template) {
    let letterText: string | null = null;

    if (parsed.data.letter_text_override && parsed.data.letter_text_override.trim().length > 0) {
      // Coordinator previewed and edited the letter — use their text verbatim.
      letterText = parsed.data.letter_text_override.trim();
    } else {
      const appCtx = await loadApplicationContext(applicationId);
      // history fetched but unused here; kept for potential prompt enrichment
      void buildHistory;
      const briefingRow = briefing
        ? await sb.from("application_briefings").select("reasoning").eq("id", briefing.id).single()
        : { data: null };
      const summary = briefingRow.data?.reasoning ?? `Application reviewed by coordinator.`;

      try {
        const filled = await fillLetter(
          {
            templateText: template.template_text,
            templateType,
            procedureName: appCtx?.procedure.name ?? "UM Procedure",
            studentProfile: appCtx?.studentProfile ?? {
              full_name: null, faculty: null, programme: null,
              year: null, cgpa: null, citizenship: "MY",
            },
            applicationSummary: summary,
            coordinatorComment: parsed.data.comment ?? null,
            detectedPlaceholders: template.detected_placeholders ?? [],
          },
          { applicationId }
        );
        letterText = filled.filled_text;
      } catch (err) {
        console.error("[decide] letter generation failed — falling back to raw template:", err);
        // Don't silently emit no letter and still flip the status — the student
        // would see "approved" with no letter and no path to recovery. Better
        // to send the raw template (placeholders unfilled) so the letter
        // exists; a coordinator can regenerate with letter_text_override later.
        letterText = template.template_text;
      }
    }

    if (letterText) {
      const { data: letterRow } = await sb
        .from("application_letters")
        .insert({
          application_id: applicationId,
          template_id: template.id,
          letter_type: templateType,
          generated_text: letterText,
          delivered_to_student_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      letterRowId = letterRow?.id ?? null;
    }
  }

  await sb
    .from("applications")
    .update({
      status: newStatus,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  return apiSuccess({
    decided: true,
    kind: parsed.data.decision,
    new_status: newStatus,
    letter_id: letterRowId,
  });
}
