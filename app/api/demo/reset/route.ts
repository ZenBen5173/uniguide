/**
 * POST /api/demo/reset
 *
 * Wipes the Demo Student's workflows so the next sign-in starts fresh
 * (intent → plan → fill steps → submit → approve, with no leftover data).
 *
 * Anyone can call this — it only touches the demo accounts, which are
 * public hackathon-demo credentials with no sensitive data.
 */

import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const DEMO_STUDENT_EMAIL = "demo-student@uniguide.local";
const DEMO_COORD_EMAIL = "demo-coordinator@uniguide.local";

export async function POST() {
  const sb = getServiceSupabase();

  // Find the demo users.
  const { data: users, error: usersErr } = await sb
    .from("users")
    .select("id, email")
    .in("email", [DEMO_STUDENT_EMAIL, DEMO_COORD_EMAIL]);
  if (usersErr) return apiError(`Lookup failed: ${usersErr.message}`, 500);

  const studentId = users?.find((u) => u.email === DEMO_STUDENT_EMAIL)?.id;
  if (!studentId) return apiError("Demo student not found", 404);

  // Wipe the student's applications. Cascades clean steps/briefings/decisions/letters.
  const { error: appErr } = await sb.from("applications").delete().eq("user_id", studentId);
  if (appErr) return apiError(`Wipe failed: ${appErr.message}`, 500);

  // Wipe any orphan reasoning trace rows from this student's prior applications.
  await sb.from("glm_reasoning_trace").delete().is("workflow_id", null);

  return apiSuccess({ reset: true });
}
