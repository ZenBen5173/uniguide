/**
 * POST /api/profile/bootstrap
 *
 * Called immediately after sign-in. Returns whether the user needs onboarding.
 * Doesn't create anything yet — onboarding form does the actual writes.
 */

import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export async function POST() {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return apiError("Not authenticated", 401);

  const service = getServiceSupabase();
  const { data: existing } = await service
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  return apiSuccess({
    needs_onboarding: !existing,
    role: existing?.role ?? null,
  });
}
