/**
 * GET  /api/admin/procedures/[id]/letter-templates    list templates for a procedure
 * POST /api/admin/procedures/[id]/letter-templates    create or replace a template
 *
 * Body (POST): { template_type, name, template_text }
 *   detected_placeholders auto-extracted from template_text via {{...}} regex.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  template_type: z.enum(["acceptance", "rejection", "request_info", "custom"]),
  name: z.string().min(1).max(120),
  template_text: z.string().min(20),
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
    .select("id, template_type, name, detected_placeholders, updated_at")
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

  const placeholders = extractPlaceholders(parsed.data.template_text);

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("procedure_letter_templates")
    .upsert({
      procedure_id: procedureId,
      template_type: parsed.data.template_type,
      name: parsed.data.name,
      template_text: parsed.data.template_text,
      detected_placeholders: placeholders,
      created_by: user.id,
    }, { onConflict: "procedure_id,template_type,name" })
    .select()
    .single();

  if (error) return apiError(`Failed: ${error.message}`, 500);

  return apiSuccess({ template: data });
}
