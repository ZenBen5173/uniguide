/**
 * POST /api/applications/[id]/escalate
 *
 * Student-driven escalation. Sets the application's escalation_pending
 * flag, records the timestamp, and persists a pinned escalation_summary
 * message that the coordinator UI surfaces at the top of the chat.
 *
 * Hybrid model — the application's STATUS is unchanged. A pre-submit
 * draft stays a draft; the student keeps filling steps and can submit
 * normally. The escalation flag is what surfaces the application on the
 * coordinator's Triage tab.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  /** Pre-drafted summary from the studentChat AI call, or a fallback the
   *  student typed themselves. */
  summary: z.string().min(1).max(2000),
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

  const { data: app } = await sb
    .from("applications")
    .select("user_id, status, escalation_pending")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  if (app.user_id !== user.id) return apiError("Forbidden", 403);
  if (app.escalation_pending) {
    return apiError("An escalation is already open for this application.", 409);
  }

  // Insert the pinned summary as an AI-authored escalation_summary message.
  // Using author_role='ai' because the summary content is AI-generated; the
  // student is the trigger but not the author of the wording.
  const { error: msgErr } = await sb
    .from("application_messages")
    .insert({
      application_id: applicationId,
      author_id: null,
      author_role: "ai",
      kind: "escalation_summary",
      body: parsed.data.summary,
    });
  if (msgErr) {
    return apiError(`Failed to record escalation summary: ${msgErr.message}`, 500);
  }

  // Flip the flag + timestamp. Status stays as-is (the hybrid model).
  await sb
    .from("applications")
    .update({
      escalation_pending: true,
      escalation_opened_at: new Date().toISOString(),
      escalation_resolved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  return apiSuccess({ escalated: true });
}
