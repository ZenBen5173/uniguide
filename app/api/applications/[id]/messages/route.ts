/**
 * GET  /api/applications/[id]/messages   thread for this application
 * POST /api/applications/[id]/messages   add a message (role inferred from caller)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({ body: z.string().min(1).max(4000) });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const { id: applicationId } = await ctx.params;
  const sb = getServiceSupabase();

  // Auth: owner OR staff/admin
  const { data: app } = await sb
    .from("applications")
    .select("user_id")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);
  const isOwner = app.user_id === user.id;
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isOwner && !isStaff) return apiError("Forbidden", 403);

  // Direct-messages surface only — student↔coordinator. AI turns and
  // escalation summaries live on the Ask UniGuide panel; mixing them here
  // would duplicate that channel.
  const { data: rawMessages } = await sb
    .from("application_messages")
    .select("id, body, author_id, author_role, created_at")
    .eq("application_id", applicationId)
    .in("author_role", ["student", "coordinator"])
    .order("created_at", { ascending: true });

  const messages = rawMessages ?? [];

  // Resolve author display names: coordinators from staff_profiles, students from student_profiles.
  const coordIds = [...new Set(messages.filter(m => m.author_role === "coordinator").map(m => m.author_id))];
  const studentIds = [...new Set(messages.filter(m => m.author_role === "student").map(m => m.author_id))];

  const [coordProfiles, studentProfiles] = await Promise.all([
    coordIds.length
      ? sb.from("staff_profiles").select("user_id, full_name").in("user_id", coordIds).then(r => r.data ?? [])
      : Promise.resolve([] as { user_id: string; full_name: string }[]),
    studentIds.length
      ? sb.from("student_profiles").select("user_id, full_name").in("user_id", studentIds).then(r => r.data ?? [])
      : Promise.resolve([] as { user_id: string; full_name: string }[]),
  ]);

  const nameById = new Map<string, string>();
  coordProfiles.forEach(p => nameById.set(p.user_id, p.full_name));
  studentProfiles.forEach(p => nameById.set(p.user_id, p.full_name));

  return apiSuccess({
    messages: messages.map(m => ({
      id: m.id,
      body: m.body,
      author_id: m.author_id,
      author_role: m.author_role,
      author_name: nameById.get(m.author_id) ?? (m.author_role === "coordinator" ? "Coordinator" : "Student"),
      created_at: m.created_at,
      is_mine: m.author_id === user.id,
    })),
    viewer_role: isStaff ? "coordinator" : "student",
  });
}

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

  // Auth + role determination
  const { data: app } = await sb
    .from("applications")
    .select("user_id")
    .eq("id", applicationId)
    .single();
  if (!app) return apiError("Application not found", 404);

  const isOwner = app.user_id === user.id;
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isOwner && !isStaff) return apiError("Forbidden", 403);

  const author_role = isStaff ? "coordinator" : "student";

  const { data, error } = await sb
    .from("application_messages")
    .insert({
      application_id: applicationId,
      author_id: user.id,
      author_role,
      body: parsed.data.body,
    })
    .select("id, body, author_id, author_role, created_at")
    .single();
  if (error) return apiError(`Failed: ${error.message}`, 500);

  return apiSuccess({ message: data }, 201);
}
