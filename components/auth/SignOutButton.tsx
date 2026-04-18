"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    const sb = getBrowserSupabase();
    await sb.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button onClick={signOut} className="btn-ghost text-sm text-slate-500">
      Sign out
    </button>
  );
}
