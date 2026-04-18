import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import AdminProcedures from "@/components/admin/AdminProcedures";

export default async function AdminPage() {
  const user = await requireRole("admin");
  if (!user) redirect("/login?next=/admin");

  const sb = getServiceSupabase();
  const { data: profile } = await sb
    .from("staff_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = profile?.full_name ?? user.email.split("@")[0];
  const initials = name.split(/\s+/).map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "A";

  return <AdminProcedures user={{ name, initials, email: user.email }} />;
}
