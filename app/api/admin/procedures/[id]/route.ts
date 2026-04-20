/**
 * PATCH /api/admin/procedures/[id]
 * Update procedure metadata. Currently supports deadline_date + deadline_label.
 * (Other fields go through the SOP upload endpoint.)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  deadline_date: z.string().nullable().optional(),
  deadline_label: z.string().max(120).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  faculty_scope: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const update: Record<string, unknown> = {};
  if (parsed.data.deadline_date !== undefined) update.deadline_date = parsed.data.deadline_date;
  if (parsed.data.deadline_label !== undefined) update.deadline_label = parsed.data.deadline_label;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.faculty_scope !== undefined) update.faculty_scope = parsed.data.faculty_scope;

  if (Object.keys(update).length === 0) return apiError("No updatable fields in body", 400);

  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("procedures")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) return apiError(error.message, 500);
  return apiSuccess({ procedure: data });
}
