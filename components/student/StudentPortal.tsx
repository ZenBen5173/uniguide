"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/shared/TopBar";
import { ProcedureIcon } from "@/components/shared/ProcedureIcon";
import { getBrowserSupabase } from "@/lib/supabase/client";

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
  deadline_date?: string | null;
  deadline_label?: string | null;
}

export default function StudentPortal({ user }: { user: { name: string; initials: string; email?: string } }) {
  const router = useRouter();
  const [apps, setApps] = useState<MyApplication[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshApps = async () => {
    try {
      const a = await fetch("/api/applications").then((r) => r.json());
      if (a.ok) setApps(a.data.applications);
    } catch {
      // ignore — initial load already showed error
    }
  };

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

  // Realtime: when any of this user's applications flips status, refetch list
  // so the portal badge updates without a manual reload.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      channel = supabase
        .channel(`portal:${authUser.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "applications", filter: `user_id=eq.${authUser.id}` },
          () => { void refreshApps(); }
        )
        .subscribe();
    })();
    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
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

      <main className="mx-auto max-w-[1180px] px-4 sm:px-8 pt-6 sm:pt-8 pb-20">
        {/* Welcome */}
        <section className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-4 mb-1.5">
              {new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-[24px] sm:text-[30px] leading-[1.1] font-semibold tracking-tight m-0">
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

        {/* KPI strip */}
        {!loading && apps.length > 0 && (() => {
          const inFlight = apps.filter(a => ["draft", "submitted", "under_review", "more_info_requested"].includes(a.status)).length;
          const approved = apps.filter(a => a.status === "approved").length;
          const needsReply = apps.filter(a => a.status === "more_info_requested").length;
          return (
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
              <PortalKpi k="Total" v={apps.length} sub="all time" />
              <PortalKpi k="In flight" v={inFlight} sub="working / waiting" />
              <PortalKpi k="Approved" v={approved} sub="this year" tone="moss" />
              <PortalKpi k="Needs your reply" v={needsReply} sub={needsReply > 0 ? "respond soon" : "all caught up"} tone={needsReply > 0 ? "crimson" : undefined} />
            </section>
          );
        })()}

        {/* My Applications */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[15px] font-semibold tracking-tight uppercase tracking-[0.08em] text-ink-4">My Applications</h2>
            <span className="text-[12px] text-ink-4 mono">{apps.length} total</span>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="ug-card p-4 animate-pulse">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-[10px] bg-line-2" />
                    <div className="w-14 h-5 rounded-md bg-line-2" />
                  </div>
                  <div className="h-4 rounded bg-line-2 mb-2 w-2/3" />
                  <div className="h-3 rounded bg-line-2 w-1/2 mb-3" />
                  <div className="h-1 rounded-full bg-line-2 w-full" />
                </div>
              ))}
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {apps.map((a) => (
                <Link
                  key={a.id}
                  href={`/student/applications/${a.id}`}
                  className="ug-card ug-tile-link p-4 no-underline"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="grid place-items-center w-9 h-9 rounded-[10px] bg-paper-2 border border-line-2 text-ink-3">
                      <ProcedureIcon procedureId={a.procedure_id} className="h-[18px] w-[18px]" />
                    </div>
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

        {/* Available Services — only ready */}
        {(() => {
          const ready = procedures.filter(p => (p.sop_chunks ?? 0) > 0);
          const comingSoon = procedures.filter(p => (p.sop_chunks ?? 0) === 0);
          return (
            <>
              <section className="mb-10">
                <div className="flex items-baseline justify-between mb-3">
                  <h2 className="text-[15px] font-semibold tracking-[0.08em] uppercase text-ink-4">Available services</h2>
                  <span className="text-[12px] text-ink-4 mono">{ready.length} ready to apply</span>
                </div>
                {ready.length === 0 && !loading && (
                  <div className="ug-card p-4 text-ink-4 text-sm">No services published yet — ask your admin to upload an SOP.</div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ready.map((p) => (
                    <div
                      key={p.id}
                      className="ug-card ug-tile-link p-4 flex flex-col"
                      onClick={() => startApplication(p.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") startApplication(p.id); }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="grid place-items-center w-9 h-9 rounded-[10px] border bg-paper-2 border-line-2 text-ink-2">
                          <ProcedureIcon procedureId={p.id} className="h-[18px] w-[18px]" />
                        </div>
                        <span className="ug-pill ok" style={{ padding: "2px 8px", fontSize: "10.5px" }}><span className="dot" />Live</span>
                      </div>
                      <div className="text-[14.5px] font-semibold text-ink leading-tight mb-1">{p.name}</div>
                      <div className="text-[12px] text-ink-3 mb-3 leading-snug flex-1">
                        {p.description ?? "—"}
                      </div>
                      <DeadlineChip date={p.deadline_date ?? null} label={p.deadline_label ?? null} />
                      <div className="flex items-center justify-between mt-auto">
                        <div className="text-[10.5px] text-ink-4 mono">
                          {p.faculty_scope ?? "All faculties"}
                        </div>
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
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {comingSoon.length > 0 && (
                <section>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-[13px] font-semibold tracking-[0.08em] uppercase text-ink-4">Coming soon</h2>
                    <span className="text-[11.5px] text-ink-4 mono">{comingSoon.length} in roadmap</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {comingSoon.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-[10px] border border-dashed border-line-2 bg-paper-2/60 px-3 py-2.5 flex items-center gap-2.5 opacity-75"
                        title={p.description ?? p.name}
                      >
                        <div className="grid place-items-center w-7 h-7 rounded-[8px] bg-line-2/50 text-ink-5 flex-shrink-0">
                          <ProcedureIcon procedureId={p.id} className="h-[14px] w-[14px]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-ink-3 leading-tight truncate">{p.name}</div>
                          <div className="text-[10.5px] text-ink-4 italic mt-0.5">awaiting SOP</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          );
        })()}

        {error && <div className="mt-6 ug-card p-4 text-sm text-crimson border-crimson">{error}</div>}
      </main>
    </>
  );
}

function DeadlineChip({ date, label }: { date: string | null; label: string | null }) {
  if (!date && !label) return null;
  const ms = date ? new Date(date).getTime() - Date.now() : null;
  const daysLeft = ms === null ? null : Math.ceil(ms / (24 * 60 * 60 * 1000));
  const tone = daysLeft === null ? "neutral" : daysLeft < 0 ? "past" : daysLeft <= 7 ? "urgent" : daysLeft <= 30 ? "soon" : "neutral";
  const cls = {
    neutral: "bg-paper-2 text-ink-3 border-line-2",
    soon: "bg-amber-soft text-amber border-[#E8DBB5]",
    urgent: "bg-crimson-soft text-crimson border-[#E8C5CB]",
    past: "bg-line-2 text-ink-4 border-line",
  }[tone];
  const text = label
    ? label
    : daysLeft === null ? "" :
      daysLeft < 0 ? "Closed" :
      daysLeft === 0 ? "Closes today" :
      daysLeft === 1 ? "1 day left" :
      `${daysLeft} days left`;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border mb-2 ${cls}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
      {text}
    </div>
  );
}

function PortalKpi({ k, v, sub, tone }: { k: string; v: number; sub?: string; tone?: "moss" | "crimson" }) {
  const cls = tone === "moss" ? "border-[#CFDDCF] bg-moss-soft" : tone === "crimson" ? "border-[#E8C5CB] bg-crimson-soft" : "border-line bg-card";
  const valueCls = tone === "moss" ? "text-moss" : tone === "crimson" ? "text-crimson" : "text-ink";
  return (
    <div className={`rounded-[10px] px-3.5 py-2.5 border ${cls}`}>
      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-4">{k}</div>
      <div className={`text-[22px] font-semibold mt-0.5 leading-none ${valueCls}`}>{v}</div>
      {sub && <div className="text-[10.5px] text-ink-4 mt-1.5">{sub}</div>}
    </div>
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
