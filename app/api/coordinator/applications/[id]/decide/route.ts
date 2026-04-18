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

const Body = z.object({
  decision: z.enum(["approve", "reject", "request_info"]),
  comment: z.string().max(2000).optional(),
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

    const result = await emitNextStep({
      applicationId,
      coordinatorRequest: requestText,
    });

    await sb
      .from("applications")
      .update({ status: "more_info_requested", updated_at: new Date().toISOString() })
      .eq("id", applicationId);

    return apiSuccess({
      decided: true,
      kind: "request_info",
      next_step: result.complete ? null : result.step,
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
    const appCtx = await loadApplicationContext(applicationId);
    const history = await buildHistory(applicationId);
    const briefingRow = briefing
      ? await sb.from("application_briefings").select("reasoning").eq("id", briefing.id).single()
      : { data: null };
    const summary = briefingRow.data?.reasoning ?? `Application reviewed by coordinator.`;

    let filled;
    try {
      filled = await fillLetter(
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
    } catch (err) {
      // Letter generation failed — still record the decision but skip letter.
      console.error("[decide] letter generation failed:", err);
      filled = null;
    }

    if (filled) {
      const { data: letterRow } = await sb
        .from("application_letters")
        .insert({
          application_id: applicationId,
          template_id: template.id,
          letter_type: templateType,
          generated_text: filled.filled_text,
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
