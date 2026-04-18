/**
 * Smart Application page — student-facing application flow.
 * Backend already wired: GET /api/applications/[id], POST /respond + /submit.
 */

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import SmartApplication from "@/components/student/SmartApplication";

export default async function StudentApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await requireUser();
  if (!user) redirect(`/login?next=/student/applications/${id}`);

  // Fetch student profile name for top bar.
  const sb = getServiceSupabase();
  const { data: profile } = await sb
    .from("student_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = profile?.full_name ?? user.email.split("@")[0];
  const initials = name
    .split(/\s+/)
    .map((p: string) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "U";

  return <SmartApplication id={id} user={{ name, initials, email: user.email }} />;
}
