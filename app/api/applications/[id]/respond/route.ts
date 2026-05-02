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
import { withTimeout } from "@/lib/utils/timeout";

// PDF extraction is "nice to have" — if it doesn't return inside this
// window, we proceed without enrichment so the route's main job
// (advance the application) still has time inside maxDuration to call
// nextStep. Z.AI under load has been observed at 30-60s per call.
const PARSE_DOCUMENT_TIMEOUT_MS = 12_000;

export const runtime = "nodejs";
// Live GLM calls observed at 30-60s on Z.AI under load. The respond path
// fires up to 2 GLM calls (parseDocument + nextStep) plus a Storage download
// + pdf-parse, so we need the full 60s ceiling. The inline timeout wrappers
// below cap each GLM call independently so a slow one degrades gracefully
// rather than burning the whole budget.
export const maxDuration = 60;

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
        const parseResult = await withTimeout(
          parseDocument(
            {
              documentText: extracted.text,
              extractionSchema,
            },
            { workflowId: applicationId }
          ),
          PARSE_DOCUMENT_TIMEOUT_MS,
          "parseDocument"
        );
        enrichedResponse = {
          ...enrichedResponse,
          extracted_fields: parseResult.fields,
          extracted_source_excerpt: parseResult.source_excerpt,
          extracted_pages: extracted.numpages,
        };
      }
    } catch (err) {
      console.warn("[respond] document extraction failed/timed out; proceeding without enrichment:", err);
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

  // If emitNextStep failed but the step was recorded, surface a `stuck`
  // flag so the UI can offer a Resume button instead of leaving the
  // application in a "no current step" dead end.
  if ("stuck" in result && result.stuck) {
    return apiSuccess({
      is_complete: false,
      next_step: null,
      stuck: true,
      error: result.error,
    });
  }

  return apiSuccess({
    is_complete: result.complete,
    next_step: result.complete ? null : result.step,
  });
}
