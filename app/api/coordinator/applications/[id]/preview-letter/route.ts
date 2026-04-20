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

  // Hallucination check: scan the letter for facts and verify against the
  // application context. Catches things like a wrong CGPA or a different
  // student name that would otherwise embarrass the office.
  const issues = checkForHallucinations(filled.filled_text, {
    full_name: appCtx?.studentProfile?.full_name ?? null,
    faculty: appCtx?.studentProfile?.faculty ?? null,
    programme: appCtx?.studentProfile?.programme ?? null,
    year: appCtx?.studentProfile?.year ?? null,
    cgpa: appCtx?.studentProfile?.cgpa ?? null,
    procedure_name: appCtx?.procedure.name ?? null,
  });

  return apiSuccess({
    letter_text: filled.filled_text,
    unfilled_placeholders: filled.unfilled_placeholders,
    template_name: template.name,
    template_type: templateType,
    hallucination_issues: issues,
  });
}

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

/**
 * Pragmatic regex-based hallucination check. Not exhaustive — catches the
 * common GLM mistakes (wrong CGPA / name / programme) by extracting any
 * concrete value the letter mentions for a known field and comparing it.
 */
function checkForHallucinations(letter: string, ctx: FactContext): HallucinationIssue[] {
  const issues: HallucinationIssue[] = [];
  const text = letter.toLowerCase();

  // 1. Unfilled {{...}} placeholders
  const unfilled = letter.match(/\{\{[^}]+\}\}/g);
  if (unfilled) {
    issues.push({
      severity: "block",
      field: "placeholders",
      message: `Unfilled template placeholders: ${[...new Set(unfilled)].join(", ")}`,
    });
  }

  // 2. CGPA — find any "CGPA" mention followed by a decimal, compare with profile.
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

  // 3. Year — letter says "Year N" — compare with profile.year
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

  // 4. Full name — if the letter has any obvious "Dear X," with a name not matching the student.
  if (ctx.full_name && ctx.full_name.length > 1) {
    const dearMatch = letter.match(/Dear\s+([A-Z][a-zA-Z'\s.\-bin]{1,80}?)[,\n]/);
    if (dearMatch) {
      const greeted = dearMatch[1].trim();
      const studentLower = ctx.full_name.toLowerCase();
      const greetedLower = greeted.toLowerCase();
      const sharesAnyToken = studentLower.split(/\s+/).some((tok) => tok.length > 2 && greetedLower.includes(tok));
      if (!sharesAnyToken) {
        issues.push({
          severity: "warn",
          field: "name",
          message: `Letter is addressed to "${greeted}" but the student is "${ctx.full_name}".`,
        });
      }
    }
  }

  // 5. Faculty — if letter mentions a faculty code that isn't the student's
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

  // 6. Programme — quick check that the programme name (if mentioned at all) matches
  if (ctx.programme && ctx.programme.length > 3) {
    // Check for wrong programmes only if the letter is detailed enough to mention one.
    // Heuristic: if "programme" or "programme:" appears, verify the value following it.
    const progMatch = letter.match(/program(?:me)?[:\s]+([A-Z][\w\s\-&]{2,60}?)[\.\n,]/i);
    if (progMatch) {
      const mentioned = progMatch[1].trim().toLowerCase();
      const expected = ctx.programme.toLowerCase();
      if (!mentioned.includes(expected.split(/\s+/)[0]) && !expected.includes(mentioned.split(/\s+/)[0])) {
        issues.push({
          severity: "warn",
          field: "programme",
          message: `Letter mentions programme "${progMatch[1].trim()}" but student is enrolled in "${ctx.programme}".`,
        });
      }
    }
  }

  void text; // reserved for future broader checks
  return issues;
}
