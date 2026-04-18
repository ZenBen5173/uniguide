/**
 * GET  /api/admin/procedures            list all procedures + meta
 * POST /api/admin/procedures            create a new procedure (id, name, description, faculty_scope)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const CreateBody = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, "lowercase letters, digits, underscore only").min(3).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  source_url: z.string().url().optional(),
  faculty_scope: z.string().max(40).nullable().optional(),
});

export async function GET() {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  const sb = getServiceSupabase();
  const { data: procedures } = await sb
    .from("procedures")
    .select("id, name, description, source_url, faculty_scope, indexed_at")
    .order("name");

  // Per-procedure meta: chunk count, active application count, letter template count
  const ids = (procedures ?? []).map((p) => p.id);
  const [{ data: chunks }, { data: applications }, { data: templates }] = await Promise.all([
    sb.from("procedure_sop_chunks").select("procedure_id"),
    sb.from("applications").select("procedure_id, status"),
    sb.from("procedure_letter_templates").select("procedure_id"),
  ]);

  const chunkCount = (chunks ?? []).reduce<Record<string, number>>(
    (acc, c) => ((acc[c.procedure_id] = (acc[c.procedure_id] || 0) + 1), acc), {}
  );
  const activeAppCount = (applications ?? []).filter((a) =>
    ["draft", "submitted", "under_review", "more_info_requested"].includes(a.status)
  ).reduce<Record<string, number>>((acc, a) => ((acc[a.procedure_id] = (acc[a.procedure_id] || 0) + 1), acc), {});
  const tplCount = (templates ?? []).reduce<Record<string, number>>(
    (acc, t) => ((acc[t.procedure_id] = (acc[t.procedure_id] || 0) + 1), acc), {}
  );

  const enriched = (procedures ?? []).map((p) => ({
    ...p,
    sop_chunks: chunkCount[p.id] ?? 0,
    active_applications: activeAppCount[p.id] ?? 0,
    letter_templates: tplCount[p.id] ?? 0,
  })).filter(p => ids.includes(p.id));

  return apiSuccess({ procedures: enriched });
}

export async function POST(req: NextRequest) {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("procedures")
    .insert({
      id: parsed.data.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      source_url: parsed.data.source_url ?? null,
      faculty_scope: parsed.data.faculty_scope ?? null,
    })
    .select()
    .single();
  if (error) return apiError(`Failed: ${error.message}`, 500);

  return apiSuccess({ procedure: data }, 201);
}
