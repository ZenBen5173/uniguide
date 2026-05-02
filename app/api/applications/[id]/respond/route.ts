/**
 * POST /api/applications/[id]/respond
 *
 * Body: { step_id, response_data }
 * Records the student's response to the current pending step,
 * then triggers nextStep to emit the following step.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { recordResponseAndAdvance } from "@/lib/applications/engine";
import { extractTextFromStorage } from "@/lib/documents/extractText";
import { parseDocument } from "@/lib/glm/parseDocument";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  step_id: z.string().uuid(),
  response_data: z.record(z.string(), z.unknown()),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

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

  // Verify ownership.
  const { data: app } = await sb
    .from("applications")
    .select("user_id, status")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (app.user_id !== user.id) return apiError("Forbidden", 403);
  if (["approved", "rejected", "withdrawn"].includes(app.status)) {
    return apiError(`Application is ${app.status} — cannot modify`, 409);
  }

  // Verify the step belongs to this application + is pending. Also reject
  // final_submit steps explicitly: those go through POST /submit, not /respond.
  // The frontend already enforces this, but a malicious client could otherwise
  // advance past a final_submit by hitting /respond directly.
  const { data: step } = await sb
    .from("application_steps")
    .select("id, status, type, config")
    .eq("id", parsed.data.step_id)
    .eq("application_id", applicationId)
    .single();
  if (!step) return apiError("Step not found", 404);
  if (step.status !== "pending") return apiError("Step already completed", 409);
  if (step.type === "final_submit") {
    return apiError("This is the final submit step — call POST /submit, not /respond.", 409);
  }

  // If this is a file_upload step and the AI emitted an extraction_schema,
  // pull the file out of storage, run it through pdf-parse, and call
  // parseDocument so the next nextStep call sees structured fields instead
  // of just a filename. Failures here NEVER block the student — they degrade
  // gracefully to the raw responseData, mirroring the resilience pattern used
  // in /submit when the briefing call fails.
  let enrichedResponse = parsed.data.response_data as Record<string, unknown>;
  const stepConfig = (step.config ?? {}) as Record<string, unknown>;
  const extractionSchema = stepConfig.extraction_schema as
    | Record<string, string>
    | undefined;
  const storagePath = enrichedResponse.storage_path as string | undefined;
  const contentType = enrichedResponse.content_type as string | null | undefined;
  if (
    step.type === "file_upload" &&
    extractionSchema &&
    Object.keys(extractionSchema).length > 0 &&
    storagePath
  ) {
    try {
      const extracted = await extractTextFromStorage(storagePath, contentType);
      if (extracted) {
        const parseResult = await parseDocument(
          {
            documentText: extracted.text,
            extractionSchema,
          },
          { workflowId: applicationId }
        );
        enrichedResponse = {
          ...enrichedResponse,
          extracted_fields: parseResult.fields,
          extracted_source_excerpt: parseResult.source_excerpt,
          extracted_pages: extracted.numpages,
        };
      }
    } catch (err) {
      console.warn("[respond] document extraction failed; proceeding without enrichment:", err);
    }
  }

  let result;
  try {
    result = await recordResponseAndAdvance({
      applicationId,
      stepId: parsed.data.step_id,
      responseData: enrichedResponse,
    });
  } catch (err) {
    return apiError(`Advance failed: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }

  return apiSuccess({
    is_complete: result.complete,
    next_step: result.complete ? null : result.step,
  });
}
