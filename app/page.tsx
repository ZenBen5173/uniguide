import Link from "next/link";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import SignOutButton from "@/components/auth/SignOutButton";

const procedures = [
  { id: "scholarship_application", name: "Scholarship & Financial Aid", emoji: "💰", scope: "Yayasan UM • JPA • MARA • MyBrainSc" },
  { id: "final_year_project", name: "Final Year Project", emoji: "🎓", scope: "FSKTM • UG" },
  { id: "deferment_of_studies", name: "Deferment of Studies", emoji: "⏸️", scope: "All faculties" },
  { id: "exam_result_appeal", name: "Exam Result Appeal", emoji: "📝", scope: "Reg.40 • 2-week window" },
  { id: "postgrad_admission", name: "Postgrad Admission", emoji: "🎒", scope: "IPS • Master's / PhD" },
  { id: "emgs_visa_renewal", name: "EMGS Visa Renewal", emoji: "🛂", scope: "International students" },
];

export default async function LandingPage() {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();

  let role: string | null = null;
  if (user) {
    const service = getServiceSupabase();
    const { data: profile } = await service
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = profile?.role ?? null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-block h-7 w-7 rounded-md bg-brand-600" />
            <span className="text-lg font-semibold tracking-tight">UniGuide</span>
            <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              UMHackathon 2026
            </span>
          </div>
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                {role === "admin" ? (
                  <Link href="/admin" className="btn-ghost text-sm">Admin</Link>
                ) : role === "staff" ? (
                  <Link href="/coordinator/inbox" className="btn-ghost text-sm">Inbox</Link>
                ) : (
                  <Link href="/student/portal" className="btn-ghost text-sm">My applications</Link>
                )}
                <span className="text-sm text-slate-500">{user.email}</span>
                <SignOutButton />
              </>
            ) : (
              <Link href="/login" className="btn-ghost text-sm">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-600">
            AI-driven workflow assistant
          </p>
          <h1 className="mt-3 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Your AI co-pilot for university paperwork.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-slate-600">
            Tell UniGuide what you need — like <em>"i need a scholarship, my family is B40"</em> —
            and Z.AI's GLM filters the right scholarships, walks you through the application, and
            pre-digests your submission for the staff who'll approve it.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href={user ? "/student/portal" : "/login?next=/student/portal"} className="btn-primary">
              Start an application
            </Link>
            <Link
              href="https://github.com/ZenBen5173/uniguide"
              className="btn-ghost border border-slate-200"
            >
              View on GitHub
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold">Procedures we support</h2>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {procedures.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="text-3xl">{p.emoji}</div>
                <h3 className="mt-2 font-semibold">{p.name}</h3>
                <p className="text-sm text-slate-500">{p.scope}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              t: "Plain English in",
              b: 'Type "i need a scholarship, my family income is RM3500, cgpa 3.1" and let GLM understand the rest.',
            },
            {
              t: "Personalised plan out",
              b: "GLM reads the official SOP and renders your workflow on a visual canvas — branched for your specific case.",
            },
            {
              t: "Adaptive at every step",
              b: "Questions reword themselves. Documents auto-parse. Decisions reason over what you actually said.",
            },
          ].map((x) => (
            <div key={x.t}>
              <h3 className="text-lg font-semibold">{x.t}</h3>
              <p className="mt-1 text-slate-600">{x.b}</p>
            </div>
          ))}
        </section>

        <footer className="mt-24 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          UniGuide — UMHackathon 2026 · Domain 1: AI Systems & Agentic Workflow Automation · Powered by Z.AI GLM
        </footer>
      </main>
    </div>
  );
}
