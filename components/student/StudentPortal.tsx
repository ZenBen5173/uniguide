"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/shared/TopBar";

interface MyApplication {
  id: string;
  procedure_id: string;
  status: string;
  progress_current_step: number;
  progress_estimated_total: number | null;
  student_summary: string | null;
  created_at: string;
  procedures?: { name: string };
}

interface Procedure {
  id: string;
  name: string;
  description: string | null;
  faculty_scope: string | null;
  sop_chunks?: number;
  letter_templates?: number;
}

const PROCEDURE_ICONS: Record<string, string> = {
  scholarship_application: "💰",
  final_year_project: "🎓",
  deferment_of_studies: "⏸️",
  exam_result_appeal: "📝",
  postgrad_admission: "🎒",
  emgs_visa_renewal: "🛂",
};

export default function StudentPortal({ user }: { user: { name: string; initials: string; email?: string } }) {
  const router = useRouter();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          fetch("/api/applications").then((r) => r.json()),
          fetch("/api/admin/procedures").then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (a.ok) setApps(a.data.applications);
        if (p.ok) setProcedures(p.data.procedures);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startApplication = async (procedureId: string) => {
    setStarting(procedureId);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedure_id: procedureId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      router.push(`/student/applications/${json.data.application.id}`);
    } finally {
      setStarting(null);
    }
  };

  return (
    <>
      <TopBar
        user={user}
        nav={[
          { href: "/student/portal", label: "Portal", active: true },
          { href: "/student/portal", label: "My Applications" },
        ]}
      />

      <main className="mx-auto max-w-[1320px] px-10 pt-8 pb-20">
        {/* Welcome */}
        <section className="mb-9">
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-tight m-0 mb-2">
            Welcome back, <span className="serif italic font-normal text-ink-2">{user.name.split(" ")[0]}</span>
          </h1>
          <p className="text-[15px] text-ink-3 max-w-2xl">
            Pick a service to begin a new application, or continue one you've already started.
          </p>
        </section>

        {/* My Applications */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Applications</h2>
            <span className="text-[13px] text-ink-4 mono">{apps.length} total</span>
          </div>
          {loading ? (
            <div className="ug-card p-6 text-ink-4 text-sm">Loading…</div>
          ) : apps.length === 0 ? (
            <div className="ug-card p-8 text-center">
              <p className="text-[15px] text-ink-3 mb-1.5">You haven't started anything yet.</p>
              <p className="text-[13px] text-ink-4">Pick a service below to get going.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3.5">
              {apps.map((a) => (
                <Link
                  key={a.id}
                  href={`/student/applications/${a.id}`}
                  className="ug-card p-5 no-underline hover:border-ink-5 transition"
                >
                  <div className="text-2xl mb-2">{PROCEDURE_ICONS[a.procedure_id] ?? "📄"}</div>
                  <div className="text-[15px] font-semibold text-ink mb-1">{a.procedures?.name ?? a.procedure_id}</div>
                  <div className="text-[12.5px] text-ink-4 mb-3">
                    Started {new Date(a.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                  </div>
                  <StatusBadge status={a.status} />
                  {a.progress_estimated_total && a.status === "draft" && (
                    <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-4">
                      <span className="mono">{a.progress_current_step}/{a.progress_estimated_total}</span>
                      <div className="flex-1 h-1 rounded bg-line-2 overflow-hidden">
                        <div className="h-full bg-ink" style={{ width: `${(a.progress_current_step / a.progress_estimated_total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Available Services */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Available services</h2>
            <span className="text-[13px] text-ink-4">{procedures.filter(p => (p.sop_chunks ?? 0) > 0).length} ready</span>
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            {procedures.map((p) => {
              const ready = (p.sop_chunks ?? 0) > 0;
              return (
                <div key={p.id} className={`ug-card p-5 ${ready ? "" : "opacity-60"}`}>
                  <div className="text-2xl mb-2">{PROCEDURE_ICONS[p.id] ?? "📄"}</div>
                  <div className="text-[15px] font-semibold text-ink mb-1">{p.name}</div>
                  <div className="text-[12.5px] text-ink-3 mb-3 leading-snug min-h-[36px]">
                    {p.description ?? ""}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11.5px] text-ink-4 mono">
                      {p.faculty_scope ?? "All faculties"} · {p.sop_chunks ?? 0} SOP sections
                    </div>
                    {ready ? (
                      <button
                        className="ug-btn primary sm"
                        onClick={() => startApplication(p.id)}
                        disabled={starting === p.id}
                      >
                        {starting === p.id ? "Starting…" : "Apply"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-ink-4 italic">SOP not yet indexed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {error && <div className="mt-6 ug-card p-4 text-sm text-crimson border-crimson">{error}</div>}
      </main>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-line-2 text-ink-3 border-line" },
    submitted: { label: "Submitted", cls: "bg-amber-soft text-amber border-[#E8DBB5]" },
    under_review: { label: "Under review", cls: "bg-amber-soft text-amber border-[#E8DBB5]" },
    more_info_requested: { label: "Needs your reply", cls: "bg-crimson-soft text-crimson border-[#E8C5CB]" },
    approved: { label: "Approved", cls: "bg-moss-soft text-moss border-[#CFDDCF]" },
    rejected: { label: "Rejected", cls: "bg-crimson-soft text-crimson border-[#E8C5CB]" },
    withdrawn: { label: "Withdrawn", cls: "bg-line-2 text-ink-4 border-line" },
  };
  const m = map[status] ?? { label: status, cls: "bg-line-2 text-ink-3 border-line" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11.5px] font-semibold border ${m.cls}`}>
      {m.label}
    </span>
  );
}
