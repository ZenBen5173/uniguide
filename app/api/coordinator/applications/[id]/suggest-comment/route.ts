/**
 * POST /api/coordinator/applications/[id]/suggest-comment
 *
 * Body: { intent: "request_info" | "approve" | "reject" }
 *
 * Drafts a short coordinator-side comment based on the briefing flags and
 * the chosen decision intent. Used to pre-fill the "Comment to student"
 * textarea so coordinators don't start from a blank box.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { callGlm } from "@/lib/glm/client";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  intent: z.enum(["request_info", "approve", "reject"]),
});

const SYSTEM_PROMPT = `You are an assistant helping a Universiti Malaya scholarship coordinator draft a short, professional comment for a student.

Output a JSON object: { "comment": string }

Constraints:
- 1-3 short sentences. Polite but direct.
- Tailor to the decision intent and the briefing reasoning + flags.
- For "request_info": specify EXACTLY what to provide (document name, missing field, etc.). Mention deadline if implied.
- For "approve": congratulate briefly + state next concrete action (sign letter, attend briefing, etc.).
- For "reject": state the primary reason in one line + mention appeal pathway (Reg. 40 within 14 days).
- Never invent facts not in the briefing. If unsure, write a generic but useful nudge.
- Use English. Address the student in second person ("you"). No greetings, sign-offs, or salutations — just the body.`;

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

  const [{ data: app }, { data: briefing }] = await Promise.all([
    sb.from("applications")
      .select("id, procedure_id, student_summary, procedures(name), student_profiles!applications_user_id_fkey(full_name, faculty, programme, year, cgpa)")
      .eq("id", applicationId)
      .single(),
    sb.from("application_briefings")
      .select("recommendation, reasoning, flags, extracted_facts")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!app) return apiError("Application not found", 404);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sp = (app as any).student_profiles ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = (app as any).procedures ?? null;

  const userPrompt = JSON.stringify({
    intent: parsed.data.intent,
    procedure: proc?.name ?? app.procedure_id,
    student_first_name: sp?.full_name?.split(/\s+/)[0] ?? null,
    student_summary: app.student_summary ?? null,
    briefing_reasoning: briefing?.reasoning ?? null,
    briefing_flags: briefing?.flags ?? [],
    extracted_facts: briefing?.extracted_facts ?? null,
  });

  let result;
  try {
    result = await callGlm({
      model: "glm-4.5-flash",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      jsonMode: true,
      maxTokens: 400,
      temperature: 0.4,
      mockFixture: `suggest_comment_${parsed.data.intent}`,
    });
  } catch (err) {
    return apiError(`AI suggest failed: ${err instanceof Error ? err.message : "unknown"}`, 500);
  }

  let parsedOutput: { comment: string };
  try {
    parsedOutput = JSON.parse(result.text);
  } catch {
    return apiError("AI returned malformed output", 500);
  }

  if (typeof parsedOutput.comment !== "string" || parsedOutput.comment.trim().length === 0) {
    return apiError("AI returned an empty suggestion", 500);
  }

  return apiSuccess({ suggested_comment: parsedOutput.comment.trim() });
}
