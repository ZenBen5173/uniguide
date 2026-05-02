"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/shared/TopBar";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { StepBody, type StepShape } from "./StepRenderers";
import SopViewer, { type SopViewerHandle } from "./SopViewer";
import AiChatPanel from "@/components/student/AiChatPanel";
import MessageThread from "@/components/shared/MessageThread";

const draftKey = (appId: string, stepId: string) => `uniguide:draft:${appId}:${stepId}`;

interface ApplicationData {
  application: {
    id: string;
    procedure_id: string;
    status: string;
    progress_current_step: number;
    progress_estimated_total: number | null;
    student_summary: string | null;
    escalation_pending?: boolean | null;
    escalation_opened_at?: string | null;
    escalation_resolved_at?: string | null;
    procedures?: { name: string; description: string | null; deadline_date?: string | null; deadline_label?: string | null };
  };
  steps: Array<{
    id: string;
    ordinal: number;
    type: string;
    prompt_text: string;
    config: Record<string, unknown>;
    emitted_by: "ai" | "coordinator";
    status: "pending" | "completed" | "skipped";
    response_data: Record<string, unknown> | null;
    completed_at: string | null;
  }>;
  letters: Array<{ id: string; letter_type: string; generated_text: string; created_at: string }>;
}

export default function SmartApplication({ id, user }: { id: string; user: { name: string; initials: string; email?: string } }) {
  const router = useRouter();
  const [data, setData] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const hydratedRef = useRef<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/applications/${id}`);
      if (res.status === 401) {
        router.push("/login?next=/student/applications/" + id);
        return;
      }
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setData(json.data);
      setDraftValue({});
      hydratedRef.current = null;
      setLastSavedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [id]);

  // Realtime: refetch whenever this application's row, its steps, or its
  // letters change server-side. Lets the student see the coordinator decision
  // (status flip + new letter) without a manual refresh.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`app:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `id=eq.${id}` },
        () => { void refresh(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_steps", filter: `application_id=eq.${id}` },
        () => { void refresh(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "application_letters", filter: `application_id=eq.${id}` },
        () => { void refresh(); }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const completed = useMemo(() => (data?.steps ?? []).filter((s) => s.status === "completed"), [data]);
  const current = useMemo(() => (data?.steps ?? []).find((s) => s.status === "pending"), [data]);

  // Hydrate draft from localStorage when current step changes.
  useEffect(() => {
    if (typeof window === "undefined" || !current) return;
    if (hydratedRef.current === current.id) return;
    try {
      const raw = window.localStorage.getItem(draftKey(id, current.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setDraftValue(parsed);
        }
      }
    } catch {
      // ignore corrupt drafts
    }
    hydratedRef.current = current.id;
  }, [id, current?.id]);

  // Persist draft to localStorage whenever it changes (debounced).
  useEffect(() => {
    if (typeof window === "undefined" || !current) return;
    if (hydratedRef.current !== current.id) return;
    if (Object.keys(draftValue).length === 0) return;
    const key = draftKey(id, current.id);
    const handle = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(draftValue));
        setLastSavedAt(Date.now());
      } catch {
        // quota or privacy mode — silently ignore
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [draftValue, id, current?.id]);

  // Re-render the relative timestamp every 15s without resetting state.
  useEffect(() => {
    const t = setInterval(() => setSavedTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  void savedTick;

  const autoSaveLabel = lastSavedAt ? relativeAge(lastSavedAt) : "not saved yet";

  const [withdrawing, setWithdrawing] = useState(false);
  const [revisingStepId, setRevisingStepId] = useState<string | null>(null);
  const sopRef = useRef<SopViewerHandle | null>(null);

  const reviseStep = async (stepId: string, ordinal: number) => {
    if (!confirm(`Revise Step ${ordinal}? Your answer for this step + all answers after it will be cleared so the AI can replan from your new response.`)) return;
    setRevisingStepId(stepId);
    try {
      const res = await fetch(`/api/applications/${id}/revise/${stepId}`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        alert(`Could not revise: ${json.error}`);
        return;
      }
      await refresh();
    } finally {
      setRevisingStepId(null);
    }
  };

  const withdraw = async () => {
    if (!confirm("Withdraw this application? Your draft + uploaded files stay for audit, but the application stops here. This cannot be undone.")) return;
    setWithdrawing(true);
    try {
      const res = await fetch(`/api/applications/${id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(`Could not withdraw: ${json.error}`);
        return;
      }
      router.push("/student/portal");
    } finally {
      setWithdrawing(false);
    }
  };

  const submitStep = async () => {
    if (!current) return;
    setSubmitting(true);
    try {
      if (current.type === "final_submit") {
        const res = await fetch(`/api/applications/${id}/submit`, { method: "POST" });
        const json = await res.json();
        if (!json.ok) { setError(json.error); return; }
        if (typeof window !== "undefined") window.localStorage.removeItem(draftKey(id, current.id));
        await refresh();
        return;
      }
      const res = await fetch(`/api/applications/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_id: current.id, response_data: draftValue }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey(id, current.id));
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar user={user} />
        <main className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-20 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-10">
          <section>
            <div className="h-3 w-32 rounded bg-line-2 mb-4 animate-pulse" />
            <div className="h-8 w-2/3 rounded bg-line-2 mb-3 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-line-2 mb-6 animate-pulse" />
            <div className="ug-card p-5 mb-3.5 animate-pulse">
              <div className="h-4 w-1/3 rounded bg-line-2 mb-3" />
              <div className="h-3 w-full rounded bg-line-2 mb-2" />
              <div className="h-3 w-5/6 rounded bg-line-2" />
            </div>
            <div className="ug-card p-5 animate-pulse">
              <div className="h-4 w-1/4 rounded bg-line-2 mb-3" />
              <div className="h-3 w-full rounded bg-line-2 mb-2" />
              <div className="h-3 w-4/5 rounded bg-line-2 mb-2" />
              <div className="h-3 w-3/5 rounded bg-line-2" />
            </div>
          </section>
          <aside className="hidden lg:block">
            <div className="ug-card p-4 animate-pulse">
              <div className="h-3 w-1/2 rounded bg-line-2 mb-3" />
              <div className="h-3 w-full rounded bg-line-2 mb-2" />
              <div className="h-3 w-2/3 rounded bg-line-2" />
            </div>
          </aside>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <TopBar user={user} />
        <main className="mx-auto max-w-[1320px] px-10 py-12 text-crimson">{error ?? "Application not found"}</main>
      </>
    );
  }

  const procedureName = data.application.procedures?.name ?? "Application";
  const totalEstimate = data.application.progress_estimated_total ?? 6;
  const completedCount = completed.length;
  const progressDots = Array.from({ length: totalEstimate }, (_, i) => {
    if (i < completedCount) return "done";
    if (current && i === completedCount) return "current";
    return "future";
  });
  const isSubmitted = ["submitted", "under_review", "more_info_requested", "approved", "rejected", "withdrawn"].includes(data.application.status);

  return (
    <>
      <TopBar
        user={user}
        nav={[{ href: "/student/portal", label: "Portal" }]}
      />

      <main className="mx-auto max-w-[1320px] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-10 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-20">
        <section>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[13px] text-ink-4 mb-3.5">
            <Link href="/student/portal" className="text-ink-4 hover:text-ink no-underline">Portal</Link>
            <span className="opacity-50">›</span>
            <Link href="/student/portal" className="text-ink-4 hover:text-ink no-underline">Scholarships &amp; Financial Aid</Link>
            <span className="opacity-50">›</span>
            <span className="text-ink font-medium">{procedureName}</span>
          </div>

          {/* Title block — pills full-width below so they don't wrap */}
          <div className="mb-4">
            <h1 className="text-[24px] sm:text-[28px] lg:text-[34px] leading-[1.1] font-semibold tracking-tight m-0 mb-2">
              {procedureName} <span className="serif italic font-normal text-ink-2">— smart application</span>
            </h1>
            <p className="text-[14px] lg:text-[15px] text-ink-3 max-w-2xl leading-snug">
              A guided, personalised application prepared from the official UM SOP and your profile. Answers are saved automatically.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="ug-pill whitespace-nowrap">
                <span className="dot" />
                {isSubmitted
                  ? <span className="capitalize">{data.application.status.replace(/_/g, " ")}</span>
                  : `Draft · Step ${completedCount + (current ? 1 : 0)} of ~${totalEstimate}`}
              </span>
              {!isSubmitted && (
                <span className="ug-pill whitespace-nowrap" title="Rough estimate based on remaining steps">
                  <span className="dot" />
                  {(() => {
                    const remaining = Math.max(0, totalEstimate - completedCount);
                    if (remaining === 0) return "Almost done";
                    const mins = Math.max(1, remaining * 2);
                    return `~${mins} min remaining`;
                  })()}
                </span>
              )}
              {(() => {
                const dd = data.application.procedures?.deadline_date ?? null;
                const dl = data.application.procedures?.deadline_label ?? null;
                if (!dd && !dl) return null;
                const ms = dd ? new Date(dd).getTime() - Date.now() : null;
                const daysLeft = ms === null ? null : Math.ceil(ms / (24 * 60 * 60 * 1000));
                const tone = daysLeft === null ? "" : daysLeft < 0 ? "" : daysLeft <= 7 ? "warn" : "";
                const text = dl
                  ? `Deadline · ${dl}`
                  : daysLeft === null ? "Deadline" :
                    daysLeft < 0 ? "Closed" :
                    daysLeft === 0 ? "Closes today" :
                    daysLeft === 1 ? "1 day left" :
                    `${daysLeft} days left`;
                return (
                  <span className={`ug-pill whitespace-nowrap ${tone}`}>
                    <span className="dot" />
                    {text}
                  </span>
                );
              })()}
              <span className="ug-pill ai whitespace-nowrap">
                <span className="dot" />
                Guided by UniGuide AI
              </span>
            </div>
          </div>

          {/* Progress strip */}
          <div className="ug-progress-strip">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[13px] text-ink-3">Application progress</span>
              <span className="text-[13px] font-semibold text-ink">
                {completedCount}<span className="text-ink-5 font-normal mx-1.5">/</span>{totalEstimate} steps complete
              </span>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(totalEstimate, 12)}, 1fr)` }}>
              {progressDots.map((s, i) => (
                <div key={i} className={`ug-progress-step ${s === "done" ? "done" : s === "current" ? "current" : ""}`} />
              ))}
            </div>
          </div>

          {/* First-step orientation hint — only shown before any step is completed */}
          {!isSubmitted && completed.length === 0 && current && (
            <div className="rounded-[12px] border border-ai-line bg-ai-tint px-4 py-3 mb-4 text-[13px] text-ai-ink leading-snug flex items-start gap-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <span className="font-semibold">First step.</span>{" "}
                UniGuide asks one question at a time, adapting based on your answers + the official SOP.
                Fill in below and hit <span className="font-semibold">Submit step</span> — the next step appears automatically.
                Your draft auto-saves, so you can leave and return anytime.
              </div>
            </div>
          )}

          {/* Step stack */}
          <div className="flex flex-col gap-3.5">

            {/* Completed steps */}
            {completed.map((s) => (
              <article key={s.id} className="ug-step done">
                <div className="ug-step-header">
                  <div className="ug-step-index">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] mono text-ink-4 uppercase tracking-wider">Step {s.ordinal}</span>
                      <span className="text-[11px] text-ink-4">·</span>
                      <span className="text-[12.5px] text-ink-3 font-medium">{stepTypeLabel(s.type)}</span>
                    </div>
                    <div className="ug-step-summary mt-1 truncate">{summariseResponse(s.response_data)}</div>
                  </div>
                  <div className="ug-step-meta flex items-center gap-2">
                    {!isSubmitted && (
                      <button
                        onClick={() => reviseStep(s.id, s.ordinal)}
                        disabled={revisingStepId !== null}
                        className="text-[11.5px] text-ink-4 hover:text-crimson font-medium disabled:opacity-50"
                        title="Edit this answer (clears later steps so the AI can replan)"
                      >
                        {revisingStepId === s.id ? "Revising…" : "Revise"}
                      </button>
                    )}
                    <span className="text-[11.5px] text-moss font-medium">Saved</span>
                  </div>
                </div>
              </article>
            ))}

            {/* Current step (interactive) */}
            {current && !isSubmitted && (
              <article className="ug-step current">
                <div className="ug-step-header">
                  <div className="ug-step-index">{current.ordinal}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] mono text-ink-4 uppercase tracking-wider">Step {current.ordinal}</span>
                      <span className="text-[11px] text-ink-4">·</span>
                      <span className="text-[15px] font-semibold text-ink">{stepTypeLabel(current.type)}</span>
                      {current.emitted_by === "ai" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider bg-ai-tint text-ai-ink border border-ai-line">
                          <span className="w-1.5 h-1.5 rounded-full bg-ai-ink" />
                          Adaptive
                        </span>
                      )}
                      {current.emitted_by === "coordinator" && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-wider bg-crimson-soft text-crimson border border-[#E8C5CB]">
                          From coordinator
                        </span>
                      )}
                    </div>
                    <div className="text-[13px] text-ink-4 mt-0.5">{stepHintForType(current.type)}</div>
                    {(() => {
                      const cites = (current.config as Record<string, unknown>)?.citations as string[] | undefined;
                      if (!cites || cites.length === 0) return null;
                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ai-ink">based on SOP</span>
                          {cites.slice(0, 3).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => sopRef.current?.openWithSection(c)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-ai-tint text-ai-ink border border-ai-line hover:bg-card hover:border-ink-5 mono"
                              title={`Open the "${c}" section of the source SOP`}
                            >
                              §{c}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="ug-step-meta flex items-center gap-1.5 text-[11.5px] text-ink-4">
                    <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-moss">
                      <span className="absolute -inset-1 rounded-full border-[1.5px] border-moss opacity-40 animate-ping" />
                    </span>
                    <span>Auto-saving</span>
                  </div>
                </div>
                <div className="ug-step-body">
                  <StepBody
                    step={current as StepShape}
                    value={draftValue}
                    onChange={setDraftValue}
                    applicationId={id}
                  />

                  <div className="ug-step-footer">
                    <div className="ug-step-footer-left">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Your answers are encrypted and shared only with the relevant office.
                    </div>
                    <div className="ug-step-footer-right">
                      <button className="ug-btn primary" onClick={submitStep} disabled={submitting}>
                        {submitting ? "Submitting…" : current.type === "final_submit" ? "Submit application" : "Submit step"}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* Future placeholder */}
            {current && totalEstimate - (completedCount + 1) > 0 && (
              <article className="ug-step future">
                <div className="ug-step-header">
                  <div className="ug-step-index">{current.ordinal + 1}</div>
                  <div>
                    <div className="ug-step-title">More to come</div>
                    <div className="ug-step-sub">UniGuide will tell you what's next once you submit this step. Estimated {totalEstimate - completedCount - 1} more steps.</div>
                  </div>
                  <div className="ug-step-meta">Locked</div>
                </div>
              </article>
            )}

            {/* Submitted state */}
            {isSubmitted && (
              <article className="ug-step current" style={{ borderColor: "#CFDDCF" }}>
                <div className="ug-step-header">
                  <div className="ug-step-index" style={{ background: "var(--moss)", color: "white" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="ug-step-title capitalize">Application {data.application.status.replace(/_/g, " ")}</div>
                    <div className="ug-step-sub">
                      {data.application.status === "submitted" || data.application.status === "under_review"
                        ? "Your application is now with the Yayasan UM Office. You'll be notified here when they respond."
                        : data.application.status === "approved"
                        ? "Congratulations — your application was approved. Your acceptance letter is in the right rail."
                        : data.application.status === "rejected"
                        ? "Your application was not approved this round. See the letter in the right rail for the reviewer's notes and appeal pathway."
                        : data.application.status === "withdrawn"
                        ? "You withdrew this application. Your draft + uploaded files are kept for reference but no further action will be taken."
                        : "More information was requested. Look for a coordinator message in the step list."}
                    </div>
                  </div>
                </div>
              </article>
            )}
          </div>

          {/* Auto-save indicator */}
          <div className="flex items-center justify-between mt-7 text-[12.5px] text-ink-4">
            <div className="flex items-center gap-2.5">
              {lastSavedAt ? (
                <>
                  <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-moss">
                    <span className="absolute -inset-1 rounded-full border-[1.5px] border-moss opacity-40 animate-ping" />
                  </span>
                  <span>
                    Draft saved to this browser
                    <span className="opacity-60"> · </span>
                    <span className="mono text-ink-3">{autoSaveLabel}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink-5" />
                  <span>Start typing — your draft saves to this browser automatically.</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {!isSubmitted && data.application.status !== "withdrawn" && (
                <button
                  onClick={withdraw}
                  disabled={withdrawing}
                  className="text-ink-4 hover:text-crimson text-[12.5px] disabled:opacity-50"
                >
                  {withdrawing ? "Withdrawing…" : "Withdraw application"}
                </button>
              )}
              <Link href={`/student/portal`} className="text-ink-3 no-underline hover:text-ink">
                Save & exit →
              </Link>
            </div>
          </div>
        </section>

        {/* Right rail */}
        <aside className="lg:sticky lg:top-[84px] lg:self-start flex flex-col gap-3.5">
          <div className="ug-rail-card">
            <div className="ug-rail-head">
              <div className="ug-rail-title">What <span className="serif">I've</span> shared so far</div>
              <span className="text-xs text-ink-4">{completedCount} answer{completedCount === 1 ? "" : "s"}</span>
            </div>
            <div className="py-1.5">
              {completed.length === 0 && (
                <div className="px-4 py-4 text-[13px] text-ink-4">
                  Nothing yet. As you complete each step, the key facts will appear here.
                </div>
              )}
              {completed.map((s, i) => (
                <div key={s.id} className={`ug-summary-item ${i === completed.length - 1 ? "ai" : ""}`}>
                  <span className="ug-summary-dot" />
                  <div>
                    <div className="ug-summary-k">Step {s.ordinal}</div>
                    <div className="ug-summary-v text-[13px]">
                      {summariseResponse(s.response_data)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.application.student_summary && (
            <div className="rounded-[14px] border border-ai-line bg-ai-tint p-4">
              <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-ai-ink">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l2.35 5.6L20 8l-4 4 1.1 5.9L12 15.5 6.9 17.9 8 12 4 8l5.65-.4z" />
                </svg>
                AI understands
              </div>
              <div className="text-[13px] text-ai-ink/80 leading-relaxed">{data.application.student_summary}</div>
            </div>
          )}

          {/* Source SOP viewer */}
          <SopViewer ref={sopRef} procedureId={data.application.procedure_id} />

          {/* Always-on AI chat — answers SOP/situation questions, can escalate to coordinator */}
          <AiChatPanel
            applicationId={id}
            escalationPending={!!data.application.escalation_pending}
          />

          {/* Direct messages with the coordinator — separate from the AI chat
              above so the student can write to a human directly without
              triggering an escalation. The two surfaces show different
              author roles: Messages is student↔coordinator only; Ask UniGuide
              is AI-led with coordinator replies appearing during an open
              escalation. */}
          <MessageThread applicationId={id} variant="rail" />

          {/* Letters delivered */}
          {data.letters.length > 0 && (
            <div className="ug-rail-card">
              <div className="ug-rail-head">
                <div className="ug-rail-title">Letters delivered</div>
              </div>
              <div className="py-1.5">
                {data.letters.map((l) => (
                  <div key={l.id} className="px-4 py-3 border-b border-line-2 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[12.5px] uppercase tracking-wider font-semibold text-ink-4">
                        {l.letter_type.replace(/_/g, " ")}
                      </div>
                      <Link
                        href={`/letters/${l.id}/print`}
                        target="_blank"
                        className="text-[11px] text-crimson hover:underline no-underline font-medium"
                      >
                        Open / Print →
                      </Link>
                    </div>
                    <pre className="text-[12px] text-ink-2 whitespace-pre-wrap font-sans leading-snug max-h-48 overflow-auto">
                      {l.generated_text}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

        </aside>
      </main>
    </>
  );
}

/* ─── helpers ─── */
function stepTypeLabel(type: string): string {
  switch (type) {
    case "form": return "A few quick details";
    case "file_upload": return "Upload a document";
    case "text": return "In your own words";
    case "select": return "Pick one";
    case "multiselect": return "Pick all that apply";
    case "info": return "Heads up";
    case "final_submit": return "Review & submit";
    case "coordinator_message": return "From the coordinator";
    default: return "Next up";
  }
}

function stepHintForType(type: string): string {
  switch (type) {
    case "form": return "Fill in the fields below.";
    case "file_upload": return "Drop the file or click to browse.";
    case "text": return "Take your time — your draft auto-saves.";
    case "select": return "Pick the option that fits.";
    case "multiselect": return "Pick all that apply.";
    case "info": return "Read and acknowledge.";
    case "final_submit": return "Last step — review and confirm.";
    case "coordinator_message": return "The coordinator is asking for something.";
    default: return "";
  }
}

function relativeAge(ts: number): string {
  const ms = Date.now() - ts;
  if (ms < 5000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function summariseResponse(data: Record<string, unknown> | null): string {
  if (!data) return "(no response)";
  if (typeof data.text === "string") {
    const t = data.text;
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  }
  if (typeof data.filename === "string") return `Uploaded ${data.filename}`;
  if (Array.isArray(data.values)) return data.values.join(", ") || "(none picked)";
  if (typeof data.value === "string") return data.value;
  if (data.confirmed) return "Confirmed.";
  if (data.acknowledged) return "Acknowledged.";
  // Fall back to comma-joined key=value pairs
  const pairs = Object.entries(data).map(([k, v]) => `${k}: ${String(v)}`);
  const joined = pairs.join(" · ");
  return joined.length > 100 ? joined.slice(0, 100) + "…" : joined;
}
