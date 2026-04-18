import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import CoordinatorAppDetail from "@/components/coordinator/CoordinatorAppDetail";

export default async function CoordinatorAppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(["staff", "admin"]);
  if (!user) redirect(`/login?next=/coordinator/applications/${id}`);

  const sb = getServiceSupabase();
  const { data: profile } = await sb
    .from("staff_profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = profile?.full_name ?? user.email.split("@")[0];
  const initials = name.split(/\s+/).map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "C";

  return <CoordinatorAppDetail id={id} user={{ name, initials, email: user.email }} />;
}
