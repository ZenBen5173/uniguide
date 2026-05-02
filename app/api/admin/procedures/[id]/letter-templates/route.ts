/**
 * GET  /api/admin/procedures/[id]/letter-templates    list templates for a procedure
 * POST /api/admin/procedures/[id]/letter-templates    create or replace a template
 *
 * Body (POST): { template_type, name, template_text, ai_templatize? }
 *
 * Pipeline:
 *  1. If ai_templatize !== false: AI converts the raw letter into a reusable
 *     template by replacing variable bits (names, dates, IDs) with
 *     `{{placeholder_name}}` substitutions that fillLetter recognises.
 *     Catches the common case where the admin uploaded a one-off filled
 *     letter that has hardcoded student data instead of placeholders.
 *  2. On AI failure, fall back to the raw text + regex-only `{{...}}`
 *     detection (the previous behaviour).
 *  3. Upsert into procedure_letter_templates with the detected_placeholders
 *     array.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { structureTemplate } from "@/lib/glm/structureTemplate";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
// structureTemplate is a single GLM call. Z.AI under load: 30-60s.
export const maxDuration = 60;

const Body = z.object({
  template_type: z.enum(["acceptance", "rejection", "request_info", "custom"]),
  name: z.string().min(1).max(120),
  template_text: z.string().min(20),
  /** When false, skip AI templatization and store the text as-is + regex-
   *  detected placeholders. Default true. Set to false when re-saving an
   *  already-templated letter. */
  ai_templatize: z.boolean().default(true),
});

function extractPlaceholders(text: string): string[] {
  const matches = text.matchAll(/\{\{[^}]+\}\}/g);
  return [...new Set([...matches].map((m) => m[0]))];
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["admin", "staff"]);
  if (!user) return apiError("Forbidden", 403);

  const { id: procedureId } = await ctx.params;
  const sb = getServiceSupabase();
  const { data: templates } = await sb
    .from("procedure_letter_templates")
    .select("id, template_type, name, template_text, detected_placeholders, updated_at")
    .eq("procedure_id", procedureId)
    .order("template_type");

  return apiSuccess({ templates: templates ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  const { id: procedureId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  // ── AI templatization ─────────────────────────────────────────────────────
  // If ai_templatize !== false, run the raw text through structureTemplate
  // to substitute variable bits with `{{placeholder}}` markers. Failures are
  // non-fatal — fall back to the raw text + regex-detected placeholders.
  let finalText = parsed.data.template_text;
  let placeholders = extractPlaceholders(parsed.data.template_text);
  let aiTemplatized = false;
  if (parsed.data.ai_templatize) {
    try {
      const result = await structureTemplate(
        {
          rawText: parsed.data.template_text,
          templateType: parsed.data.template_type,
        },
        { procedureId }
      );
      finalText = result.template_text;
      placeholders = result.detected_placeholders.length
        ? result.detected_placeholders
        : extractPlaceholders(result.template_text);
      aiTemplatized = true;
    } catch (err) {
      console.warn(
        "[letter-templates] AI templatization failed, falling back to raw text:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("procedure_letter_templates")
    .upsert({
      procedure_id: procedureId,
      template_type: parsed.data.template_type,
      name: parsed.data.name,
      template_text: finalText,
      detected_placeholders: placeholders,
      created_by: user.id,
    }, { onConflict: "procedure_id,template_type,name" })
    .select()
    .single();

  if (error) return apiError(`Failed: ${error.message}`, 500);

  return apiSuccess({ template: data, ai_templatized: aiTemplatized });
}
