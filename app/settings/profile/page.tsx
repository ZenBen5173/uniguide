"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

interface ProfileData {
  role: "student" | "staff" | "admin" | null;
  email: string;
  profile: {
    full_name?: string;
    faculty?: string | null;
    programme?: string | null;
    year?: number | null;
    cgpa?: number | null;
    citizenship?: "MY" | "INTL";
    staff_role?: "coordinator" | "dean" | "dvc" | "ips_officer";
  } | null;
}

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — populated from data on load
  const [fullName, setFullName] = useState("");
  const [faculty, setFaculty] = useState(FACULTIES[0]);
  const [programme, setProgramme] = useState("");
  const [year, setYear] = useState(3);
  const [cgpa, setCgpa] = useState("3.50");
  const [citizenship, setCitizenship] = useState<"MY" | "INTL">("MY");
  const [staffRole, setStaffRole] = useState<"coordinator" | "dean" | "dvc" | "ips_officer">("coordinator");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (res.status === 401) { router.push("/login?next=/settings/profile"); return; }
        const json = await res.json();
        if (json.ok) {
          setData(json.data);
          const p = json.data.profile;
          if (p) {
            setFullName(p.full_name ?? "");
            const matchingFaculty = FACULTIES.find((f) => f.startsWith(p.faculty ?? "")) ?? FACULTIES[0];
            setFaculty(matchingFaculty);
            setProgramme(p.programme ?? "");
            if (p.year) setYear(p.year);
            if (p.cgpa !== null && p.cgpa !== undefined) setCgpa(p.cgpa.toString());
            if (p.citizenship) setCitizenship(p.citizenship);
            if (p.staff_role) setStaffRole(p.staff_role);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const isStudent = data?.role === "student";
  const isStaff = data?.role === "staff" || data?.role === "admin";
  const homeHref = isStaff ? "/coordinator/inbox" : "/student/portal";

  const save = async () => {
    if (!fullName.trim()) {
      setError("Please enter your full name");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);

    const payload = isStudent
      ? {
          role: "student" as const,
          full_name: fullName.trim(),
          faculty: faculty.split(" ")[0],
          programme: programme.trim() || null,
          year,
          cgpa: parseFloat(cgpa) || null,
          citizenship,
        }
      : {
          role: "staff" as const,
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
    setSaving(false);
    if (!json.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-[520px] px-6 py-12">
        <div className="h-3 w-24 rounded bg-line-2 mb-3 animate-pulse" />
        <div className="h-7 w-2/3 rounded bg-line-2 mb-2 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-line-2 mb-8 animate-pulse" />
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded bg-line-2 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-12 bg-paper">
      <div className="w-full max-w-[520px]">
        <Link href={homeHref} className="text-[13px] text-ink-4 hover:text-ink no-underline inline-flex items-center gap-1 mb-6">
          ← Back
        </Link>

        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-4 mb-2">Settings</p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight m-0">
            Your profile <span className="serif italic font-normal text-ink-2">— update anytime</span>
          </h1>
          <p className="mt-2 text-[14px] text-ink-3 leading-snug">
            Updates here re-personalise future applications. Existing applications keep their original snapshot.
          </p>
          <div className="mt-3 text-[12px] text-ink-4 mono">
            Signed in as {data?.email} · role: {data?.role ?? "unknown"}
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
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>

          {isStudent && (
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
                      <option key={y} value={y}>Year {y}</option>
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
                  />
                </label>
              </div>

              <div>
                <span className="block text-[12px] uppercase tracking-[0.14em] font-semibold text-ink-4 mb-1.5">Citizenship</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border-[1.5px] text-sm font-medium transition ${
                      citizenship === "MY" ? "border-ink bg-ink text-white" : "border-line bg-card text-ink-2 hover:border-ink-5"
                    }`}
                    onClick={() => setCitizenship("MY")}
                  >
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Malaysian
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-[10px] border-[1.5px] text-sm font-medium transition ${
                      citizenship === "INTL" ? "border-ink bg-ink text-white" : "border-line bg-card text-ink-2 hover:border-ink-5"
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

          {isStaff && (
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

          <div className="flex items-center gap-3 pt-2">
            <button
              className="ug-btn primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saved && (
              <span className="text-[13px] text-moss font-medium inline-flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-moss" />
                Saved
              </span>
            )}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-[10px] bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
              {error}
            </div>
          )}
        </div>

        <div className="mt-12 pt-6 border-t border-line-2">
          <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-4 mb-2">Account</p>
          <div className="flex items-center gap-3 text-[13px] text-ink-3 flex-wrap">
            <span className="mono text-ink-2">{data?.email}</span>
            <span className="opacity-60">·</span>
            <Link href="/" className="text-ink-3 hover:text-ink no-underline">
              Sign out via the top bar →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
