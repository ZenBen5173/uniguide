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

  // Pull live status (which procedures actually have an indexed SOP) so we
  // can show accurate Live / Coming-soon badges. Cards are informational
  // only — the actual "start" flow lives on /login → portal so the demo
  // experience (role tiles, onboarding, etc.) isn't bypassed.
  const service = getServiceSupabase();
  const { data: chunkRows } = await service.from("procedure_sop_chunks").select("procedure_id");
  const liveSet = new Set((chunkRows ?? []).map((c) => c.procedure_id));

  const ctaHref = user
    ? (role === "admin" ? "/admin" : role === "staff" ? "/coordinator/inbox" : "/student/portal")
    : "/login";

  const ctaLabel = user
    ? (role === "admin" ? "Open admin console" : role === "staff" ? "Open my inbox" : "Go to my portal")
    : "Try the demo";

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
            UMHackathon 2026 · Domain 1 · AI Systems & Agentic Workflow Automation
          </p>
          <h1 className="mt-3 text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Your AI co-pilot for university paperwork.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-slate-600">
            Pick a UM procedure. Z.AI's GLM reads the official SOP, asks you only what's relevant,
            and pre-digests your submission so the coordinator can decide in minutes — not weeks.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2.5">
            <Link href={ctaHref} className="btn-primary text-base px-6 py-3">
              {ctaLabel} →
            </Link>
            {!user && (
              <p className="text-sm text-slate-500">
                One click — pick a Student / Coordinator / Admin demo account on the next screen.
              </p>
            )}
          </div>
          <div className="mt-4 text-xs text-slate-500">
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
          <p className="text-center text-sm text-slate-500 mt-2">
            Available once you're signed in. Look for the green <span className="font-semibold text-emerald-700">Live</span> badge.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PROCEDURES.map((p) => {
              const isLive = liveSet.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`card p-5 ${isLive ? "" : "opacity-60"}`}
                  title={isLive ? `${p.name} — live, available after sign-in` : "SOP not yet indexed by the admin"}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className={`grid place-items-center w-11 h-11 rounded-[12px] border ${isLive ? "bg-paper-2 border-line-2 text-ink-2" : "bg-paper-2 border-line-2 text-ink-5"}`}>
                      <ProcedureIcon procedureId={p.id} className="h-[22px] w-[22px]" />
                    </div>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider bg-moss-soft text-moss border border-[#CFDDCF]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-moss" />
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wider bg-line-2 text-ink-4 border border-line">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <h3 className={`mt-2 font-semibold ${isLive ? "text-ink" : "text-ink-3"}`}>{p.name}</h3>
                  <p className="text-sm text-slate-500">{p.scope}</p>
                </div>
              );
            })}
          </div>

          {/* Single repeated CTA so the path is obvious */}
          {!user && (
            <div className="mt-8 text-center">
              <Link href="/login" className="btn-primary">
                Sign in to start →
              </Link>
            </div>
          )}
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-semibold mb-2">How it works</h2>
          <p className="text-center text-sm text-slate-500 mb-10">Three roles, one shared application record.</p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: "1",
                role: "Student",
                t: "AI walks you through it",
                b: "Pick a procedure (Scholarship, FYP, Deferment…). The AI emits one step at a time — form, file upload, or short answer — based on your earlier responses and the official SOP. Auto-saves. Citations show which SOP section drove each question.",
              },
              {
                step: "2",
                role: "Coordinator",
                t: "Pre-digested for review",
                b: "Submitted applications land in an inbox sorted by AI urgency. Each has a briefing (recommendation, confidence, extracted facts, flags) so a 30-minute review collapses to 3 minutes. Approve / reject / request more info — the AI drafts the letter; you edit and send.",
              },
              {
                step: "3",
                role: "Admin",
                t: "Upload SOP, the rest builds itself",
                b: "Paste text, paste a URL, or upload the PDF. UniGuide chunks it, indexes it, and the procedure goes live for students. Letter templates with {{placeholders}} get auto-filled at decision time. Full GLM trace audit log included.",
              },
            ].map((x) => (
              <div key={x.role} className="card p-6">
                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-brand-600 text-white text-[10px]">{x.step}</span>
                  {x.role}
                </div>
                <h3 className="text-lg font-semibold mt-3">{x.t}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{x.b}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-24 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          UniGuide — UMHackathon 2026 · Domain 1: AI Systems & Agentic Workflow Automation · Powered by Z.AI GLM
        </footer>
      </main>
    </div>
  );
}
