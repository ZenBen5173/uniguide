/**
 * POST /api/profile
 *
 * Body (student):
 *   { role: "student", full_name, faculty?, programme?, year?, cgpa?, citizenship? }
 * Body (staff):
 *   { role: "staff", full_name, faculty?, staff_role }
 *
 * Upserts public.users + role-specific profile row.
 * Uses service role to bypass RLS (the user can't INSERT into public.users themselves).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const StudentBodySchema = z.object({
  role: z.literal("student"),
  full_name: z.string().min(1).max(120),
  faculty: z.string().max(40).nullable().optional(),
  programme: z.string().max(120).nullable().optional(),
  year: z.number().int().min(1).max(8).nullable().optional(),
  cgpa: z.number().min(0).max(4).nullable().optional(),
  citizenship: z.enum(["MY", "INTL"]).default("MY"),
});

const StaffBodySchema = z.object({
  role: z.literal("staff"),
  full_name: z.string().min(1).max(120),
  faculty: z.string().max(40).nullable().optional(),
  staff_role: z.enum(["coordinator", "dean", "dvc", "ips_officer"]),
});

const BodySchema = z.discriminatedUnion("role", [StudentBodySchema, StaffBodySchema]);

export async function POST(req: NextRequest) {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !user.email) return apiError("Not authenticated", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError(`Invalid body: ${parsed.error.message}`, 400);

  const service = getServiceSupabase();

  // Upsert the user row (mirrors auth.users + role).
  const { error: userErr } = await service
    .from("users")
    .upsert(
      { id: user.id, email: user.email, role: parsed.data.role },
      { onConflict: "id" }
    );
  if (userErr) return apiError(`Failed to save user: ${userErr.message}`, 500);

  // Upsert the role-specific profile.
  if (parsed.data.role === "student") {
    const { error: profileErr } = await service.from("student_profiles").upsert(
      {
        user_id: user.id,
        full_name: parsed.data.full_name,
        faculty: parsed.data.faculty ?? null,
        programme: parsed.data.programme ?? null,
        year: parsed.data.year ?? null,
        cgpa: parsed.data.cgpa ?? null,
        citizenship: parsed.data.citizenship,
      },
      { onConflict: "user_id" }
    );
    if (profileErr) return apiError(`Failed to save profile: ${profileErr.message}`, 500);
  } else {
    const { error: profileErr } = await service.from("staff_profiles").upsert(
      {
        user_id: user.id,
        full_name: parsed.data.full_name,
        faculty: parsed.data.faculty ?? null,
        staff_role: parsed.data.staff_role,
      },
      { onConflict: "user_id" }
    );
    if (profileErr) return apiError(`Failed to save profile: ${profileErr.message}`, 500);
  }

  return apiSuccess({ saved: true, role: parsed.data.role });
}
