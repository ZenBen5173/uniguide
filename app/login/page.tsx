"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Stage = "email" | "code";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-16 text-slate-500">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/student/intake";

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const supabase = getBrowserSupabase();

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo(`We sent a 6-digit code to ${email}. It usually arrives within 30 seconds.`);
    setStage("code");
  };

  const verifyCode = async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    if (err || !data.user) {
      setLoading(false);
      setError(err?.message ?? "Invalid code");
      return;
    }

    // Bootstrap the user's public profile if missing.
    const profileRes = await fetch("/api/profile/bootstrap", { method: "POST" });
    const profileJson = await profileRes.json();

    setLoading(false);

    if (profileJson.data?.needs_onboarding) {
      router.push("/onboarding?next=" + encodeURIComponent(next));
    } else {
      router.push(next);
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-slate-600">
        Use your email — we'll send a 6-digit code. No password needed.
      </p>

      <div className="mt-8 card p-6 space-y-4">
        {stage === "email" && (
          <>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="you@um.edu.my"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </label>
            <button
              className="btn-primary w-full"
              onClick={sendCode}
              disabled={loading || !email.includes("@")}
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </>
        )}

        {stage === "code" && (
          <>
            <label className="block">
              <span className="text-sm font-medium">Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="mt-1 w-full rounded border border-slate-200 px-3 py-3 text-center text-2xl tracking-widest"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                autoFocus
              />
            </label>
            <button
              className="btn-primary w-full"
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button
              className="btn-ghost w-full text-sm"
              onClick={() => {
                setStage("email");
                setCode("");
                setInfo(null);
              }}
              disabled={loading}
            >
              Use a different email
            </button>
          </>
        )}
      </div>

      {info && (
        <div className="mt-4 card border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {info}
        </div>
      )}
      {error && (
        <div className="mt-4 card border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        First time signing in? We'll ask for a few details (faculty, programme, CGPA) on the next screen.
      </p>
    </div>
  );
}
