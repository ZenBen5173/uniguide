/**
 * GET  /api/coordinator/applications/[id]/notes  list internal notes (staff/admin)
 * POST /api/coordinator/applications/[id]/notes  add an internal note
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({ body: z.string().min(1).max(4000) });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["staff", "admin"]);
  if (!user) return apiError("Coordinator/Admin only", 403);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();
  const { data: rawNotes } = await sb
    .from("application_coordinator_notes")
    .select("id, body, author_id, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  const notes = rawNotes ?? [];
  const authorIds = [...new Set(notes.map((n) => n.author_id))];
  const profiles = authorIds.length
    ? (await sb.from("staff_profiles").select("user_id, full_name").in("user_id", authorIds)).data ?? []
    : [];
  const nameById = new Map(profiles.map((p) => [p.user_id, p.full_name]));

  return apiSuccess({
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      author_id: n.author_id,
      author_name: nameById.get(n.author_id) ?? "Coordinator",
      created_at: n.created_at,
      is_mine: n.author_id === user.id,
    })),
  });
}

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
  const { data, error } = await sb
    .from("application_coordinator_notes")
    .insert({
      application_id: applicationId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id, body, author_id, created_at")
    .single();

  if (error) return apiError(`Failed: ${error.message}`, 500);
  return apiSuccess({ note: data }, 201);
}
