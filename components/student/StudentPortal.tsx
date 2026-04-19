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
          fetch("/api/procedures").then((r) => r.json()),
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
        nav={[{ href: "/student/portal", label: "Portal", active: true }]}
      />

      <main className="mx-auto max-w-[1180px] px-8 pt-8 pb-20">
        {/* Welcome */}
        <section className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-4 mb-1.5">
              {new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-[30px] leading-[1.1] font-semibold tracking-tight m-0">
              Welcome back, <span className="serif italic font-normal text-ink-2">{user.name.split(" ")[0]}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-ink-4">
            <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-moss">
              <span className="absolute -inset-1 rounded-full border-[1.5px] border-moss opacity-40 animate-ping" />
            </span>
            All systems normal
          </div>
        </section>

        {/* My Applications */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[15px] font-semibold tracking-tight uppercase tracking-[0.08em] text-ink-4">My Applications</h2>
            <span className="text-[12px] text-ink-4 mono">{apps.length} total</span>
          </div>
          {loading ? (
            <div className="ug-card p-4 text-ink-4 text-sm">Loading…</div>
          ) : apps.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-line-2 bg-paper-2 px-5 py-6 flex items-center gap-4">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-card border border-line text-ink-4 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[14px] text-ink-2 font-medium">Nothing in flight yet</p>
                <p className="text-[12.5px] text-ink-4 mt-0.5">Pick a service below to begin your first application.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {apps.map((a) => (
                <Link
                  key={a.id}
                  href={`/student/applications/${a.id}`}
                  className="ug-card ug-tile-link p-4 no-underline"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[22px] leading-none">{PROCEDURE_ICONS[a.procedure_id] ?? "📄"}</div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="text-[14.5px] font-semibold text-ink leading-tight mb-1">{a.procedures?.name ?? a.procedure_id}</div>
                  <div className="text-[11.5px] text-ink-4 mb-3 mono">
                    Started {new Date(a.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                  </div>
                  {a.progress_estimated_total && a.status === "draft" && (
                    <div className="flex items-center gap-2 text-[11.5px] text-ink-4">
                      <span className="mono">{a.progress_current_step}/{a.progress_estimated_total}</span>
                      <div className="flex-1 h-[3px] rounded-full bg-line-2 overflow-hidden">
                        <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${(a.progress_current_step / a.progress_estimated_total) * 100}%` }} />
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
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[15px] font-semibold tracking-[0.08em] uppercase text-ink-4">Available services</h2>
            <span className="text-[12px] text-ink-4 mono">{procedures.filter(p => (p.sop_chunks ?? 0) > 0).length} ready</span>
          </div>
          {procedures.length === 0 && !loading && (
            <div className="ug-card p-4 text-ink-4 text-sm">No services published yet — ask your admin to upload an SOP.</div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {procedures.map((p) => {
              const ready = (p.sop_chunks ?? 0) > 0;
              return (
                <div
                  key={p.id}
                  className={`ug-card p-4 flex flex-col ${ready ? "ug-tile-link" : "opacity-60"}`}
                  onClick={ready ? () => startApplication(p.id) : undefined}
                  role={ready ? "button" : undefined}
                  tabIndex={ready ? 0 : undefined}
                  onKeyDown={ready ? (e) => { if (e.key === "Enter" || e.key === " ") startApplication(p.id); } : undefined}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[22px] leading-none">{PROCEDURE_ICONS[p.id] ?? "📄"}</div>
                    {ready ? (
                      <span className="ug-pill ok" style={{ padding: "2px 8px", fontSize: "10.5px" }}><span className="dot" />Live</span>
                    ) : (
                      <span className="ug-pill" style={{ padding: "2px 8px", fontSize: "10.5px", color: "var(--ink-4)" }}><span className="dot" style={{ background: "var(--ink-5)" }} />Draft</span>
                    )}
                  </div>
                  <div className="text-[14.5px] font-semibold text-ink leading-tight mb-1">{p.name}</div>
                  <div className="text-[12px] text-ink-3 mb-3 leading-snug flex-1">
                    {p.description ?? "—"}
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-[10.5px] text-ink-4 mono">
                      {p.faculty_scope ?? "All faculties"}
                    </div>
                    {ready ? (
                      <button
                        className="ug-btn primary sm"
                        onClick={(e) => { e.stopPropagation(); startApplication(p.id); }}
                        disabled={starting === p.id}
                      >
                        {starting === p.id ? "Starting…" : "Apply"}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    ) : (
                      <span className="text-[10.5px] text-ink-4 italic">awaiting SOP</span>
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
