/**
 * GET  /api/applications              list current student's applications
 * POST /api/applications               create new application + emit Step 1
 *
 * Body (POST): { procedure_id }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { ProcedureIdSchema } from "@/lib/glm/schemas";
import { emitNextStep } from "@/lib/applications/engine";
import { estimateProgress } from "@/lib/glm/estimateProgress";
import { retrieveProcedureSop } from "@/lib/kb/retrieve";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
// POST creates an application, then fires emitNextStep (GLM) AND
// estimateProgress (GLM) in series. Two GLM calls + a Storage write.
// Z.AI under load can take 30-60s per call, so we need the full ceiling.
export const maxDuration = 60;

const CreateBody = z.object({ procedure_id: ProcedureIdSchema });

export async function GET() {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const sb = getServiceSupabase();
  const { data: applications } = await sb
    .from("applications")
    .select("id, procedure_id, status, progress_current_step, progress_estimated_total, student_summary, created_at, submitted_at, decided_at, procedures(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return apiSuccess({ applications: applications ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);
  if (user.role !== "student") return apiError("Students only", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) return apiError("procedure_id required", 400);

  const sb = getServiceSupabase();

  // Verify procedure exists + has SOP indexed.
  const { data: procedure } = await sb
    .from("procedures")
    .select("id, name")
    .eq("id", parsed.data.procedure_id)
    .single();
  if (!procedure) return apiError("Procedure not found", 404);

  const sopChunks = await retrieveProcedureSop(procedure.id);
  if (sopChunks.length === 0) {
    return apiError("This procedure's SOP has not been indexed yet — contact admin.", 412);
  }

  // Create the application row.
  const { data: app, error: appErr } = await sb
    .from("applications")
    .insert({
      user_id: user.id,
      procedure_id: procedure.id,
      status: "draft",
    })
    .select("id, procedure_id, status, progress_current_step, progress_estimated_total")
    .single();
  if (appErr || !app) return apiError(`Failed: ${appErr?.message}`, 500);

  // Estimate total steps + emit Step 1 in parallel.
  const [estimate, firstStep] = await Promise.all([
    estimateProgress(
      { procedureId: procedure.id, sopChunks, stepsCompletedSoFar: 0 },
      { applicationId: app.id }
    ),
    emitNextStep({ applicationId: app.id }),
  ]);

  await sb
    .from("applications")
    .update({ progress_estimated_total: estimate.estimated_total_steps })
    .eq("id", app.id);

  return apiSuccess({
    application: { ...app, progress_estimated_total: estimate.estimated_total_steps },
    first_step: firstStep.complete ? null : firstStep.step,
    is_complete: firstStep.complete,
  }, 201);
}
