"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-12 text-slate-500">Loading…</div>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/student/intake";

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
            faculty: faculty.split(" ")[0], // 'FSKTM' from 'FSKTM (Computer Science & IT)'
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

    router.push(role === "staff" ? "/coordinator/dashboard" : next);
  };

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">A few quick details</h1>
      <p className="mt-2 text-slate-600">
        UniGuide uses these to personalise your workflows. You can change them later.
      </p>

      <div className="mt-8 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded border-2 px-4 py-3 text-sm font-medium ${
              role === "student"
                ? "border-brand-500 bg-brand-50 text-brand-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setRole("student")}
          >
            🎓 Student
          </button>
          <button
            type="button"
            className={`flex-1 rounded border-2 px-4 py-3 text-sm font-medium ${
              role === "staff"
                ? "border-brand-500 bg-brand-50 text-brand-900"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            onClick={() => setRole("staff")}
          >
            🧑‍💼 Staff
          </button>
        </div>

        <label className="block">
          <span className="text-sm font-medium">Full name</span>
          <input
            type="text"
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ahmad bin Ali"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Faculty</span>
          <select
            className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
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
              <span className="text-sm font-medium">Programme</span>
              <input
                type="text"
                className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                placeholder="e.g. Software Engineering"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium">Year</span>
                <select
                  className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
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
                <span className="text-sm font-medium">CGPA</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  placeholder="3.50"
                />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded border px-3 py-2 text-sm ${
                  citizenship === "MY"
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white"
                }`}
                onClick={() => setCitizenship("MY")}
              >
                🇲🇾 Malaysian
              </button>
              <button
                type="button"
                className={`flex-1 rounded border px-3 py-2 text-sm ${
                  citizenship === "INTL"
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white"
                }`}
                onClick={() => setCitizenship("INTL")}
              >
                🌏 International
              </button>
            </div>
          </>
        )}

        {role === "staff" && (
          <label className="block">
            <span className="text-sm font-medium">Role</span>
            <select
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2 text-sm"
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

        <button className="btn-primary w-full" onClick={submit} disabled={loading}>
          {loading ? "Saving…" : "Continue"}
        </button>

        {error && (
          <div className="card border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
      </div>
    </div>
  );
}
