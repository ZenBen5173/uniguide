import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import StudentPortal from "@/components/student/StudentPortal";

export default async function StudentPortalPage() {
  const user = await requireUser();
  if (!user) redirect("/login?next=/student/portal");

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

  return <StudentPortal user={{ name, initials, email: user.email }} />;
}
