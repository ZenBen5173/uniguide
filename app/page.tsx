import Link from "next/link";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import SignOutButton from "@/components/auth/SignOutButton";
import { ProcedureIcon } from "@/components/shared/ProcedureIcon";

const PROCEDURES = [
  { id: "scholarship_application", name: "Scholarship & Financial Aid", scope: "Yayasan UM • JPA • MARA • MyBrainSc" },
  { id: "final_year_project", name: "Final Year Project", scope: "FSKTM • UG" },
  { id: "deferment_of_studies", name: "Deferment of Studies", scope: "All faculties" },
  { id: "exam_result_appeal", name: "Exam Result Appeal", scope: "Reg.40 • 2-week window" },
  { id: "postgrad_admission", name: "Postgrad Admission", scope: "IPS • Master's / PhD" },
  { id: "emgs_visa_renewal", name: "EMGS Visa Renewal", scope: "International students" },
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

  // Pull live status (which procedures actually have an indexed SOP).
  const service = getServiceSupabase();
  const { data: chunkRows } = await service.from("procedure_sop_chunks").select("procedure_id");
  const liveSet = new Set((chunkRows ?? []).map((c) => c.procedure_id));

  // Click-through helper: signed-in students go straight to portal with auto-start;
  // anyone else (signed-out or staff) goes through login.
  const procHref = (id: string) => {
    if (user && (role === "student" || role === null)) {
      return `/student/portal?start=${id}`;
    }
    return `/login?next=${encodeURIComponent(`/student/portal?start=${id}`)}`;
  };

  const portalHref = user
    ? (role === "admin" ? "/admin" : role === "staff" ? "/coordinator/inbox" : "/student/portal")
    : "/login?next=/student/portal";

  const portalLabel = user
    ? (role === "admin" ? "Open admin console" : role === "staff" ? "Open my inbox" : "Go to my portal")
    : "Sign in to start";

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
          <div className="mt-8 flex justify-center items-center gap-3 flex-wrap">
            <Link href={portalHref} className="btn-primary">
              {portalLabel} →
            </Link>
            <span className="text-sm text-slate-500">or pick a procedure below</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            <Link
              href="https://github.com/ZenBen5173/uniguide"
              className="text-slate-500 hover:text-slate-700"
            >
              View on GitHub →
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold">Procedures we support</h2>
          <p className="text-center text-sm text-slate-500 mt-2">Click a live procedure to start, or sign in to browse.</p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROCEDURES.map((p) => {
              const isLive = liveSet.has(p.id);
              if (!isLive) {
                return (
                  <div key={p.id} className="card p-5 opacity-60 cursor-not-allowed" title="SOP not yet indexed by the admin">
                    <div className="flex items-start justify-between mb-1">
                      <div className="grid place-items-center w-11 h-11 rounded-[12px] bg-paper-2 border border-line-2 text-ink-5">
                        <ProcedureIcon procedureId={p.id} className="h-[22px] w-[22px]" />
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider bg-line-2 text-ink-4 border border-line">
                        Coming soon
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-ink-3">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.scope}</p>
                  </div>
                );
              }
              return (
                <Link key={p.id} href={procHref(p.id)} className="card p-5 ug-tile-link no-underline block">
                  <div className="flex items-start justify-between mb-1">
                    <div className="grid place-items-center w-11 h-11 rounded-[12px] bg-paper-2 border border-line-2 text-ink-2">
                      <ProcedureIcon procedureId={p.id} className="h-[22px] w-[22px]" />
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider bg-moss-soft text-moss border border-[#CFDDCF]">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-moss" />
                      Live
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold">{p.name}</h3>
                  <p className="text-sm text-slate-500">{p.scope}</p>
                  <div className="text-xs font-medium text-crimson mt-3">
                    {user ? "Start →" : "Sign in to start →"}
                  </div>
                </Link>
              );
            })}
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
