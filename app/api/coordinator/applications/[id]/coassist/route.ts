/**
 * POST /api/coordinator/applications/[id]/coassist
 *
 * The coordinator's natural-language "tweak this" channel for an artifact
 * they're already reviewing. Three artifacts are supported:
 *
 *   • letter             — revise the AI-drafted decision letter
 *   • step_prompt        — revise the AI's proposed Request-More-Info
 *                          question
 *   • briefing_reasoning — Q&A about the briefing (briefing record itself
 *                          is NOT mutated; this is a chat surface)
 *
 * Body:
 * {
 *   artifact: "letter" | "step_prompt" | "briefing_reasoning",
 *   current_text: string,
 *   instruction: string,
 *   prior_turns?: { role: "coordinator" | "ai"; text: string }[],
 *   decision_kind?: "approve" | "reject" | "request_info"   // letter only
 * }
 *
 * For `letter`, also re-runs the regex hallucination check against the
 * revised text so the modal can re-render warnings without a separate
 * round-trip.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { coassist } from "@/lib/glm/coassist";
import { judgeLetter } from "@/lib/glm/judgeLetter";
import { loadApplicationContext } from "@/lib/applications/engine";
import { retrieveProcedureSop } from "@/lib/kb/retrieve";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  artifact: z.enum(["letter", "step_prompt", "briefing_reasoning"]),
  current_text: z.string().min(1).max(20000),
  instruction: z.string().min(1).max(2000),
  prior_turns: z
    .array(
      z.object({
        role: z.enum(["coordinator", "ai"]),
        text: z.string().min(1).max(8000),
      })
    )
    .max(20)
    .default([]),
  decision_kind: z.enum(["approve", "reject", "request_info"]).optional(),
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
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);

  const appCtx = await loadApplicationContext(applicationId);
  if (!appCtx) return apiError("Application context missing", 500);

  // Letter / step_prompt revisions benefit from SOP grounding so the AI
  // can quote rules accurately. Briefing_reasoning Q&A passes them too —
  // the AI may need to explain a flag's underlying SOP rule.
  const sopChunks = await retrieveProcedureSop(appCtx.procedure.id);

  let revised;
  try {
    revised = await coassist(
      {
        artifact: parsed.data.artifact,
        currentText: parsed.data.current_text,
        instruction: parsed.data.instruction,
        procedureName: appCtx.procedure.name,
        studentProfile: appCtx.studentProfile,
        sopChunks,
        priorTurns: parsed.data.prior_turns,
      },
      { applicationId }
    );
  } catch (err) {
    return apiError(
      `Could not revise: ${err instanceof Error ? err.message : "unknown"}`,
      500
    );
  }

  // For letter revisions, run BOTH hallucination layers on the new text so
  // the modal can re-render both banners inline without follow-up calls:
  //   1. Regex layer — structural mismatches (CGPA digits, year, faculty).
  //   2. Judge layer — GLM faithfulness check against briefing + SOP.
  // Step / briefing revisions don't need the letter judge.
  let hallucination_issues: Array<{
    severity: "warn" | "block";
    field: string;
    message: string;
  }> = [];
  let judge_issues: Awaited<ReturnType<typeof judgeLetter>>["issues"] = [];
  let judge_assessment: string | null = null;
  let judge_confidence: number | null = null;
  let judge_available = false;

  if (parsed.data.artifact === "letter") {
    hallucination_issues = checkForHallucinations(revised.revised_text, {
      full_name: appCtx.studentProfile.full_name ?? null,
      faculty: appCtx.studentProfile.faculty ?? null,
      programme: appCtx.studentProfile.programme ?? null,
      year: appCtx.studentProfile.year ?? null,
      cgpa: appCtx.studentProfile.cgpa ?? null,
      procedure_name: appCtx.procedure.name ?? null,
    });

    // Pull the briefing reasoning so the judge has the case's ground truth.
    const { data: briefing } = await sb
      .from("application_briefings")
      .select("reasoning")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    try {
      const judged = await judgeLetter(
        {
          letterText: revised.revised_text,
          templateType: parsed.data.decision_kind === "approve"
            ? "acceptance"
            : parsed.data.decision_kind === "reject"
              ? "rejection"
              : parsed.data.decision_kind === "request_info"
                ? "request_info"
                : "custom",
          procedureName: appCtx.procedure.name,
          studentProfile: appCtx.studentProfile,
          briefingReasoning: briefing?.reasoning ?? null,
          sopChunks,
          coordinatorComment: null,
        },
        { applicationId }
      );
      judge_issues = judged.issues;
      judge_assessment = judged.overall_assessment;
      judge_confidence = judged.confidence;
      judge_available = true;
    } catch (err) {
      console.error("[coassist] judge failed — degrading to regex-only:", err);
    }
  }

  return apiSuccess({
    revised_text: revised.revised_text,
    brief_explanation: revised.brief_explanation,
    hallucination_issues,
    judge_issues,
    judge_assessment,
    judge_confidence,
    judge_available,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hallucination check — same pragmatic regex logic as preview-letter.
// Kept inline here (rather than extracted) to avoid prematurely abstracting
// before the second consumer settled on a stable shape.
// ─────────────────────────────────────────────────────────────────────────────
interface FactContext {
  full_name: string | null;
  faculty: string | null;
  programme: string | null;
  year: number | null;
  cgpa: number | null;
  procedure_name: string | null;
}

interface HallucinationIssue {
  severity: "warn" | "block";
  field: string;
  message: string;
}

function checkForHallucinations(letter: string, ctx: FactContext): HallucinationIssue[] {
  const issues: HallucinationIssue[] = [];

  const unfilled = letter.match(/\{\{[^}]+\}\}/g);
  if (unfilled) {
    issues.push({
      severity: "block",
      field: "placeholders",
      message: `Unfilled template placeholders: ${[...new Set(unfilled)].join(", ")}`,
    });
  }

  if (ctx.cgpa !== null) {
    const cgpaMatches = [...letter.matchAll(/CGPA[^\d]*([0-3]\.\d{1,2}|4\.0{0,2})/gi)];
    for (const m of cgpaMatches) {
      const mentioned = parseFloat(m[1]);
      if (Math.abs(mentioned - ctx.cgpa) > 0.005) {
        issues.push({
          severity: "warn",
          field: "cgpa",
          message: `Letter mentions CGPA ${mentioned.toFixed(2)} but the application's CGPA is ${ctx.cgpa.toFixed(2)}.`,
        });
      }
    }
  }

  if (ctx.year !== null) {
    const yearMatch = letter.match(/Year\s+([1-8])/i);
    if (yearMatch && parseInt(yearMatch[1]) !== ctx.year) {
      issues.push({
        severity: "warn",
        field: "year",
        message: `Letter mentions Year ${yearMatch[1]} but the student is in Year ${ctx.year}.`,
      });
    }
  }

  if (ctx.full_name && ctx.full_name.length > 1) {
    const dearMatch = letter.match(/Dear\s+([A-Z][a-zA-Z'\s.\-bin]{1,80}?)[,\n]/);
    if (dearMatch) {
      const greeted = dearMatch[1].trim();
      const studentLower = ctx.full_name.toLowerCase();
      const greetedLower = greeted.toLowerCase();
      const sharesAnyToken = studentLower
        .split(/\s+/)
        .some((tok) => tok.length > 2 && greetedLower.includes(tok));
      if (!sharesAnyToken) {
        issues.push({
          severity: "warn",
          field: "name",
          message: `Letter is addressed to "${greeted}" but the student is "${ctx.full_name}".`,
        });
      }
    }
  }

  if (ctx.faculty) {
    const knownFaculties = ["FSKTM", "FBE", "FOE", "FOM", "FOS", "FAS", "FOL"];
    const upper = letter.toUpperCase();
    for (const f of knownFaculties) {
      if (f !== ctx.faculty && new RegExp(`\\b${f}\\b`).test(upper)) {
        issues.push({
          severity: "warn",
          field: "faculty",
          message: `Letter mentions ${f} but the student is in ${ctx.faculty}.`,
        });
      }
    }
  }

  if (ctx.programme && ctx.programme.length > 3) {
    const progMatch = letter.match(/program(?:me)?[:\s]+([A-Z][\w\s\-&]{2,60}?)[\.\n,]/i);
    if (progMatch) {
      const mentioned = progMatch[1].trim().toLowerCase();
      const expected = ctx.programme.toLowerCase();
      if (
        !mentioned.includes(expected.split(/\s+/)[0]) &&
        !expected.includes(mentioned.split(/\s+/)[0])
      ) {
        issues.push({
          severity: "warn",
          field: "programme",
          message: `Letter mentions programme "${progMatch[1].trim()}" but student is enrolled in "${ctx.programme}".`,
        });
      }
    }
  }

  return issues;
}
