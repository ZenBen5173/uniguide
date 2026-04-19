"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Briefcase, Wrench, RotateCcw } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Stage = "email" | "code";

const DEMO_STUDENT = { email: "demo-student@uniguide.local", password: "demo-student-2026" };
const DEMO_COORD =   { email: "demo-coordinator@uniguide.local", password: "demo-coord-2026" };
const DEMO_ADMIN =   { email: "demo-admin@uniguide.local", password: "demo-admin-2026" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-16 text-ink-4">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/student/portal";

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = getBrowserSupabase();

  const demoSignIn = async (
    creds: { email: string; password: string },
    redirectTo: string,
    opts: { reset?: boolean } = {}
  ) => {
    setDemoBusy(creds.email);
    setError(null); setInfo(null);
    if (opts.reset) await fetch("/api/demo/reset", { method: "POST" });
    const { error: err } = await supabase.auth.signInWithPassword(creds);
    if (err) { setDemoBusy(null); setError(err.message); return; }
    router.push(redirectTo);
    router.refresh();
  };

  const sendCode = async () => {
    setLoading(true); setError(null); setInfo(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setInfo(`We sent a 6-digit code to ${email}.`);
    setStage("code");
  };

  const verifyCode = async () => {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (err || !data.user) { setLoading(false); setError(err?.message ?? "Invalid code"); return; }
    const profileRes = await fetch("/api/profile/bootstrap", { method: "POST" });
    const profileJson = await profileRes.json();
    setLoading(false);
    if (profileJson.data?.needs_onboarding) router.push("/onboarding?next=" + encodeURIComponent(next));
    else router.push(next);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      {/* Left: brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-ink text-white relative overflow-hidden">
        <div className="absolute -right-32 -top-32 w-[400px] h-[400px] rounded-full opacity-30"
             style={{ background: "radial-gradient(circle, rgba(161,37,58,.6) 0%, transparent 65%)" }} />
        <div className="absolute -left-20 -bottom-32 w-[300px] h-[300px] rounded-full opacity-20"
             style={{ background: "radial-gradient(circle, rgba(184,147,90,.5) 0%, transparent 65%)" }} />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 text-white no-underline">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white font-bold text-sm">U</div>
            <span className="font-bold text-lg tracking-tight">UniGuide</span>
            <span className="ml-1 text-sm text-white/60 font-medium">· Universiti Malaya</span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/60 mb-4">UMHackathon 2026 · Domain 1</p>
          <h2 className="text-[40px] leading-[1.1] font-semibold tracking-tight m-0 mb-5">
            Your AI co-pilot for university <span className="serif italic font-normal">paperwork</span>.
          </h2>
          <p className="text-[15px] text-white/70 leading-relaxed">
            UniGuide reads your situation in plain English, builds your application from the official UM SOP,
            and walks you through it adaptively — catching the silent-fail traps before they cost you a semester.
          </p>
        </div>

        <div className="relative text-[12px] text-white/50">
          Powered by <span className="font-semibold text-white/70">Z.AI GLM</span> · Built by Team Breaking Bank
        </div>
      </aside>

      {/* Right: signin */}
      <main className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-12">
        <div className="mx-auto w-full max-w-[480px]">
          <Link href="/" className="text-[13px] text-ink-4 hover:text-ink no-underline inline-flex items-center gap-1">
            ← Home
          </Link>

          <h1 className="mt-5 text-[32px] leading-tight font-semibold tracking-tight">
            Sign in <span className="serif italic font-normal text-ink-2">— pick a way</span>
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-3">
            Use your email below, or jump in with a demo account so you can poke around immediately.
          </p>

          {/* Demo accounts — 3 horizontal tiles */}
          <div className="mt-7">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-4">Demo accounts · instant</span>
              <span className="flex-1 h-px bg-line" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <DemoTile
                Icon={GraduationCap}
                label="Student"
                tag="B40 · CGPA 3.10"
                accent="moss"
                busy={demoBusy === DEMO_STUDENT.email}
                disabled={!!demoBusy}
                onClick={() => demoSignIn(DEMO_STUDENT, "/student/portal")}
              />
              <DemoTile
                Icon={Briefcase}
                label="Coordinator"
                tag="Yayasan UM"
                accent="amber"
                busy={demoBusy === DEMO_COORD.email}
                disabled={!!demoBusy}
                onClick={() => demoSignIn(DEMO_COORD, "/coordinator/inbox")}
              />
              <DemoTile
                Icon={Wrench}
                label="Admin"
                tag="Manage SOPs"
                accent="navy"
                busy={demoBusy === DEMO_ADMIN.email}
                disabled={!!demoBusy}
                onClick={() => demoSignIn(DEMO_ADMIN, "/admin")}
              />
            </div>

            <button
              className="mt-2.5 w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-[10px] text-[13px] font-medium text-ink-3 hover:text-ink hover:bg-paper-2 border border-dashed border-line"
              onClick={() => demoSignIn(DEMO_STUDENT, "/student/portal", { reset: true })}
              disabled={!!demoBusy}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Reset Demo Student & sign in
              <span className="text-[11px] text-ink-4 font-normal">— wipes prior applications</span>
            </button>
          </div>

          {/* Email signin */}
          <div className="mt-7">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-4">Or use your email</span>
              <span className="flex-1 h-px bg-line" />
            </div>

            {stage === "email" && (
              <div className="space-y-3">
                <input
                  type="email"
                  className="ug-input"
                  placeholder="you@um.edu.my"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <button
                  className="ug-btn primary w-full justify-center"
                  onClick={sendCode}
                  disabled={loading || !email.includes("@")}
                >
                  {loading ? "Sending code…" : "Send 6-digit code →"}
                </button>
              </div>
            )}

            {stage === "code" && (
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="ug-input mono text-center text-[24px] tracking-[0.4em] py-3"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={loading}
                  autoFocus
                />
                <button
                  className="ug-btn primary w-full justify-center"
                  onClick={verifyCode}
                  disabled={loading || code.length !== 6}
                >
                  {loading ? "Verifying…" : "Verify & sign in"}
                </button>
                <button
                  className="ug-btn ghost w-full text-sm justify-center"
                  onClick={() => { setStage("email"); setCode(""); setInfo(null); }}
                  disabled={loading}
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>

          {info && (
            <div className="mt-4 px-4 py-3 rounded-[10px] bg-ai-tint border border-ai-line text-[13px] text-ai-ink">
              {info}
            </div>
          )}
          {error && (
            <div className="mt-4 px-4 py-3 rounded-[10px] bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
              {error}
            </div>
          )}

          <p className="mt-7 text-[12px] text-ink-4 text-center">
            First time? We'll ask for faculty, programme, and CGPA after you sign in.
          </p>
        </div>
      </main>
    </div>
  );
}

interface TileProps {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  tag: string;
  accent: "moss" | "amber" | "navy";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}

function DemoTile({ Icon, label, tag, accent, busy, disabled, onClick }: TileProps) {
  const cls = {
    moss:  "border-[#CFDDCF] hover:border-moss bg-card hover:bg-moss-soft",
    amber: "border-[#E8DBB5] hover:border-amber bg-card hover:bg-amber-soft",
    navy:  "border-line hover:border-ink   bg-card hover:bg-paper-2",
  }[accent];
  const labelTone = {
    moss: "text-moss",
    amber: "text-amber",
    navy: "text-ink",
  }[accent];
  const iconBgTone = {
    moss: "bg-moss-soft text-moss",
    amber: "bg-amber-soft text-amber",
    navy: "bg-paper-2 text-ink-2 border border-line",
  }[accent];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start gap-1 p-3.5 rounded-[12px] border transition disabled:opacity-50 ${cls}`}
    >
      <span className={`grid place-items-center w-9 h-9 rounded-[10px] mb-1 ${iconBgTone}`}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className={`text-[14px] font-semibold ${labelTone}`}>
        {busy ? "Signing in…" : label}
      </span>
      <span className="text-[11.5px] text-ink-4">{tag}</span>
    </button>
  );
}
