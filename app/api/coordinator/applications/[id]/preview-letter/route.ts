/**
 * POST /api/coordinator/applications/[id]/preview-letter
 *
 * Body: { decision: "approve" | "reject", comment?: string }
 *
 * Generates the letter that WOULD be sent if the coordinator decided this way,
 * without committing the decision. Used by the "Preview before send" modal so
 * coordinators can read & edit the letter before it goes to the student.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { fillLetter } from "@/lib/glm/fillLetter";
import { loadApplicationContext } from "@/lib/applications/engine";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
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
    .select("id, procedure_id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);

  const templateType = parsed.data.decision === "approve" ? "acceptance" : "rejection";

  const { data: template } = await sb
    .from("procedure_letter_templates")
    .select("id, name, template_text, detected_placeholders")
    .eq("procedure_id", app.procedure_id)
    .eq("template_type", templateType)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) {
    return apiError(
      `No ${templateType} letter template configured for this procedure. Decision will go through without a letter.`,
      404,
      { template_missing: true }
    );
  }

  const appCtx = await loadApplicationContext(applicationId);
  const { data: briefing } = await sb
    .from("application_briefings")
    .select("reasoning")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const summary = briefing?.reasoning ?? `Application reviewed by coordinator.`;

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
    return apiError(
      `Could not generate preview: ${err instanceof Error ? err.message : "unknown"}`,
      500
    );
  }

  return apiSuccess({
    letter_text: filled.filled_text,
    unfilled_placeholders: filled.unfilled_placeholders,
    template_name: template.name,
    template_type: templateType,
  });
}
