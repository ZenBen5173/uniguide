/**
 * POST /api/step/:id
 *
 * Body: { response_data: object }
 *
 * Records a step response and tries to advance the workflow.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { recordStepResponse } from "@/lib/workflow/stageEngine";
import { getServerSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const BodySchema = z.object({ response_data: z.record(z.string(), z.unknown()) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: stepId } = await ctx.params;

  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError("response_data must be an object", 400);

  const result = await recordStepResponse({
    stepId,
    userId: user.id,
    responseData: parsed.data.response_data,
  });

  if (!result.saved) return apiError("Failed to save response", 500);

  return apiSuccess(result);
}
