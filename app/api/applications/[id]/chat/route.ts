/**
 * POST /api/applications/[id]/chat
 *
 * Always-on student AI chat. The student types a message in the side
 * panel; we persist their message to application_messages, call the AI
 * for a reply, persist the reply, and return both rows + the
 * suggest_escalate flag so the panel can offer a one-click handoff.
 *
 * Lives in /api/applications/* (not /api/coordinator/*) because it's
 * student-facing. Auth: must be the application's owner.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { studentChat } from "@/lib/glm/studentChat";
import { buildHistory, loadApplicationContext } from "@/lib/applications/engine";
import { retrieveProcedureSop } from "@/lib/kb/retrieve";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
// Live GLM calls observed at 30-60s on Z.AI under load — a single
// student_chat call can take that long even on a warm connection.
export const maxDuration = 60;

const Body = z.object({
  message: z.string().min(1).max(4000),
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

  // Persist the student's turn.
  const { data: studentMsg, error: studentInsErr } = await sb
    .from("application_messages")
    .insert({
      application_id: applicationId,
      author_id: user.id,
      author_role: "student",
      kind: "chat",
      body: parsed.data.message,
    })
    .select("id, created_at")
    .single();
  if (studentInsErr || !studentMsg) {
    return apiError(`Failed to persist message: ${studentInsErr?.message}`, 500);
  }

  // Load context + recent chat history (last ~10 turns).
  const appCtx = await loadApplicationContext(applicationId);
  if (!appCtx) return apiError("Application context missing", 500);

  const [history, sopChunks, recentChatRows, currentStepRow] = await Promise.all([
    buildHistory(applicationId),
    retrieveProcedureSop(appCtx.procedure.id),
    sb.from("application_messages")
      .select("author_role, body, kind")
      .eq("application_id", applicationId)
      .eq("kind", "chat")
      .order("created_at", { ascending: false })
      .limit(10),
    sb.from("application_steps")
      .select("prompt_text")
      .eq("application_id", applicationId)
      .eq("status", "pending")
      .order("ordinal", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const recentChat = (recentChatRows.data ?? [])
    .reverse() // oldest → newest
    .map((r) => ({
      role: r.author_role as "student" | "ai" | "coordinator",
      text: r.body as string,
    }));

  // Call the AI. On failure, write a graceful fallback reply so the
  // student sees something instead of an error.
  let aiOutput;
  try {
    aiOutput = await studentChat(
      {
        procedureName: appCtx.procedure.name,
        studentProfile: appCtx.studentProfile,
        sopChunks,
        currentStepPrompt: currentStepRow.data?.prompt_text ?? null,
        history,
        recentChat,
        studentMessage: parsed.data.message,
      },
      { applicationId }
    );
  } catch (err) {
    console.error("[chat] studentChat failed — falling back:", err);
    aiOutput = {
      ai_response:
        "Sorry, I'm having trouble answering right now. You can keep filling out your application, " +
        "or use the Ask a coordinator button to send your question to the office directly.",
      suggest_escalate: true,
      escalation_summary:
        `Student asked: "${parsed.data.message.slice(0, 200)}". The AI helper was unavailable when this was sent — please review the application and reply directly.`,
    };
  }

  // Persist the AI's turn.
  const { data: aiMsg, error: aiInsErr } = await sb
    .from("application_messages")
    .insert({
      application_id: applicationId,
      author_id: null,
      author_role: "ai",
      kind: "chat",
      body: aiOutput.ai_response,
    })
    .select("id, created_at")
    .single();
  if (aiInsErr) {
    console.error("[chat] failed to persist AI reply:", aiInsErr);
  }

  return apiSuccess({
    student_message_id: studentMsg.id,
    ai_message_id: aiMsg?.id ?? null,
    ai_response: aiOutput.ai_response,
    suggest_escalate: aiOutput.suggest_escalate,
    escalation_summary: aiOutput.escalation_summary,
  });
}
