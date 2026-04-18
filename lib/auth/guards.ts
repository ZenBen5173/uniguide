/**
 * Auth guard helpers — pull the authenticated user + check role.
 * All API routes go through one of these.
 */

import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";

export type AppRole = "admin" | "staff" | "student";

export interface AuthedUser {
  id: string;
  email: string;
  role: AppRole;
}

export async function requireUser(): Promise<AuthedUser | null> {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !user.email) return null;

  const service = getServiceSupabase();
  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    role: (profile?.role as AppRole) ?? "student",
  };
}

export async function requireRole(role: AppRole | AppRole[]): Promise<AuthedUser | null> {
  const user = await requireUser();
  if (!user) return null;
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) return null;
  return user;
}

/** True if user is staff (coordinator) OR admin. */
export function isStaffOrAdmin(user: AuthedUser): boolean {
  return user.role === "staff" || user.role === "admin";
}
