/**
 * POST /api/intake
 *
 * Body: { text: string }
 *
 * 1. Validate input.
 * 2. Authenticate user.
 * 3. Call GLM extractIntent.
 * 4. If confidence ≥ 0.7 and procedure_id resolved → create workflow row,
 *    immediately call /api/plan to generate the workflow plan.
 *    Otherwise return clarifying questions.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { extractIntent } from "@/lib/glm/extractIntent";
import { ProcedureIdSchema } from "@/lib/glm/schemas";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const BodySchema = z.object({ text: z.string().min(1).max(4000) });

const ALL_PROCEDURE_IDS: ReturnType<typeof ProcedureIdSchema.options> = [
  "industrial_training",
  "final_year_project",
  "deferment_of_studies",
  "exam_result_appeal",
  "postgrad_admission",
  "emgs_visa_renewal",
];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError("text must be a string between 1 and 4000 chars", 400);

  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  let intent;
  try {
    intent = await extractIntent({
      text: parsed.data.text,
      availableProcedureIds: ALL_PROCEDURE_IDS,
    });
  } catch (err) {
    return apiError(`Intent extraction failed: ${err instanceof Error ? err.message : "unknown"}`, 502);
  }

  if (!intent.procedure_id || intent.confidence < 0.7) {
    return apiSuccess({
      kind: "clarify",
      confidence: intent.confidence,
      clarifying_questions: intent.clarifying_questions,
      reasoning: intent.reasoning,
    });
  }

  // Confidence sufficient — create workflow row.
  const service = getServiceSupabase();
  const { data: wf, error: wfErr } = await service
    .from("workflows")
    .insert({
      user_id: user.id,
      procedure_id: intent.procedure_id,
      status: "planning",
      intent_text: parsed.data.text,
    })
    .select("id")
    .single();

  if (wfErr || !wf) return apiError(`Failed to create workflow: ${wfErr?.message}`, 500);

  return apiSuccess({
    kind: "ready",
    workflow_id: wf.id,
    procedure_id: intent.procedure_id,
    confidence: intent.confidence,
  });
}
