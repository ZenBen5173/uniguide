"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Briefcase, MapPin, Globe } from "lucide-react";

const FACULTIES = [
  "FSKTM (Computer Science & IT)",
  "FBE (Business & Economics)",
  "FOE (Engineering)",
  "FOM (Medicine)",
  "FOS (Science)",
  "FAS (Arts & Social Sciences)",
  "FOL (Law)",
  "Other",
];

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-12 text-ink-4">Loading…</div>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/student/portal";

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "staff">("student");
  const [faculty, setFaculty] = useState(FACULTIES[0]);
  const [programme, setProgramme] = useState("");
  const [year, setYear] = useState<number>(3);
  const [cgpa, setCgpa] = useState<string>("3.50");
  const [citizenship, setCitizenship] = useState<"MY" | "INTL">("MY");
  const [staffRole, setStaffRole] = useState<"coordinator" | "dean" | "dvc" | "ips_officer">(
    "coordinator"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    setLoading(true);
    setError(null);

    const payload =
      role === "student"
        ? {
            role,
            full_name: fullName.trim(),
            faculty: faculty.split(" ")[0],
            programme: programme.trim() || null,
            year,
            cgpa: parseFloat(cgpa) || null,
            citizenship,
          }
        : {
            role,
            full_name: fullName.trim(),
            faculty: faculty.split(" ")[0],
            staff_role: staffRole,
          };

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    setLoading(false);

    if (!json.ok) {
      setError(json.error ?? "Something went wrong");
      return;
    }

    router.push(role === "staff" ? "/coordinator/inbox" : next);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-paper">
      <div className="w-full max-w-[520px]">
        <Link href="/" className="text-[13px] text-ink-4 hover:text-ink no-underline inline-flex items-center gap-1 mb-6">
          ← Home
        </Link>

        <div className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-4 mb-2">First-time setup</p>
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight m-0">
            A few quick details <span className="serif italic font-normal text-ink-2">— so we can personalise</span>
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-3 leading-snug">
            UniGuide uses these to tailor your applications. You can change them later.
          </p>
        </div>

        {/* Role */}
        <div className="mb-5">
          <label className="block text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4 mb-2">I am a…</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border-[1.5px] text-sm font-medium transition ${
                role === "student"
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-card text-ink-2 hover:border-ink-5"
              }`}
              onClick={() => setRole("student")}
            >
              <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
              Student
            </button>
            <button
              type="button"
              className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border-[1.5px] text-sm font-medium transition ${
                role === "staff"
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-card text-ink-2 hover:border-ink-5"
              }`}
              onClick={() => setRole("staff")}
            >
              <Briefcase className="h-4 w-4" strokeWidth={1.75} />
              Staff
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4">Full name</span>
            <input
              type="text"
              className="ug-input mt-1.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ahmad bin Ali"
            />
          </label>

          <label className="block">
            <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4">Faculty</span>
            <select
              className="ug-input mt-1.5"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
            >
              {FACULTIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          {role === "student" && (
            <>
              <label className="block">
                <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4">Programme</span>
                <input
                  type="text"
                  className="ug-input mt-1.5"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  placeholder="e.g. Software Engineering"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4">Year</span>
                  <select
                    className="ug-input mt-1.5"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4">CGPA</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="ug-input mt-1.5 mono"
                    value={cgpa}
                    onChange={(e) => setCgpa(e.target.value)}
                    placeholder="3.50"
                  />
                </label>
              </div>

              <div>
                <span className="block text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4 mb-1.5">Citizenship</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border-[1.5px] text-sm font-medium transition ${
                      citizenship === "MY"
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-card text-ink-2 hover:border-ink-5"
                    }`}
                    onClick={() => setCitizenship("MY")}
                  >
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Malaysian
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border-[1.5px] text-sm font-medium transition ${
                      citizenship === "INTL"
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-card text-ink-2 hover:border-ink-5"
                    }`}
                    onClick={() => setCitizenship("INTL")}
                  >
                    <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
                    International
                  </button>
                </div>
              </div>
            </>
          )}

          {role === "staff" && (
            <label className="block">
              <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4">Staff role</span>
              <select
                className="ug-input mt-1.5"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as typeof staffRole)}
              >
                <option value="coordinator">Scholarship Officer (Yayasan UM)</option>
                <option value="dean">Dean</option>
                <option value="dvc">Deputy Vice-Chancellor (Academic)</option>
                <option value="ips_officer">IPS Officer</option>
              </select>
            </label>
          )}

          <button
            className="ug-btn primary w-full justify-center mt-2"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Saving…" : "Continue →"}
          </button>

          {error && (
            <div className="px-4 py-3 rounded-[10px] bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
              {error}
            </div>
          )}
        </div>

        <p className="mt-7 text-[12px] text-ink-4 text-center">
          Your details are stored on UM-side Supabase only. Never shared with third parties.
        </p>
      </div>
    </main>
  );
}
