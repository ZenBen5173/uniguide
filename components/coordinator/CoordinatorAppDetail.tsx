"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, X, Paperclip } from "lucide-react";
import TopBar from "@/components/shared/TopBar";

interface DetailData {
  application: {
    id: string;
    user_id: string;
    procedure_id: string;
    status: string;
    ai_recommendation: "approve" | "reject" | "request_info" | null;
    ai_confidence: number | null;
    submitted_at: string | null;
    decided_at: string | null;
    procedures?: { name: string; description: string | null };
    student_profiles?: {
      full_name: string;
      faculty: string | null;
      programme: string | null;
      year: number | null;
      cgpa: number | null;
      citizenship: string;
      matric_no: string | null;
    };
  };
  briefing: {
    id: string;
    extracted_facts: Record<string, unknown>;
    flags: Array<{ severity: "info" | "warn" | "block"; message: string }>;
    recommendation: "approve" | "reject" | "request_info";
    reasoning: string;
  } | null;
  steps: Array<{
    id: string;
    ordinal: number;
    type: string;
    prompt_text: string;
    config: Record<string, unknown>;
    emitted_by: "ai" | "coordinator";
    status: string;
    response_data: Record<string, unknown> | null;
    completed_at: string | null;
  }>;
  decisions: Array<{ id: string; decision: string; comment: string | null; decided_at: string }>;
  letters: Array<{ id: string; letter_type: string; generated_text: string; created_at: string }>;
}

export default function CoordinatorAppDetail({
  id,
  user,
}: {
  id: string;
  user: { name: string; initials: string; email?: string };
}) {
  const router = useRouter();
  void router;
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Letter preview modal state
  const [previewKind, setPreviewKind] = useState<"approve" | "reject" | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLetter, setPreviewLetter] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ template_name: string; unfilled: string[] } | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/coordinator/applications/${id}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [id]);

  const openPreview = async (kind: "approve" | "reject") => {
    setPreviewKind(kind);
    setPreviewBusy(true);
    setPreviewError(null);
    setPreviewLetter("");
    setPreviewMeta(null);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/preview-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: kind, comment: comment.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.ok) {
        setPreviewError(json.error);
        return;
      }
      setPreviewLetter(json.data.letter_text);
      setPreviewMeta({
        template_name: json.data.template_name,
        unfilled: json.data.unfilled_placeholders ?? [],
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPreviewBusy(false);
    }
  };

  const confirmDecision = async () => {
    if (!previewKind) return;
    setBusy(previewKind);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: previewKind,
          comment: comment.trim() || undefined,
          letter_text_override: previewLetter || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await refresh();
        setComment("");
        setPreviewKind(null);
        setPreviewLetter("");
      }
    } finally {
      setBusy(null);
    }
  };

  const requestInfo = async () => {
    if (!comment.trim()) {
      alert("Please type what you'd like the student to provide.");
      return;
    }
    setBusy("request_info");
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "request_info", comment: comment.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        await refresh();
        setComment("");
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) return (<><TopBar user={user} roleChip={{ label: "Coordinator" }} /><main className="p-12 text-ink-4">Loading…</main></>);
  if (!data) return (<><TopBar user={user} roleChip={{ label: "Coordinator" }} /><main className="p-12 text-crimson">Application not found</main></>);

  const sp = data.application.student_profiles;
  const decided = data.application.decided_at !== null;

  return (
    <>
      <TopBar
        user={user}
        roleChip={{ label: "Coordinator · Yayasan UM" }}
        nav={[
          { href: "/coordinator/inbox", label: "Inbox" },
          { href: "/coordinator/inbox", label: "Detail view", active: true },
        ]}
      />

      <main className="mx-auto max-w-[1320px] grid grid-cols-[minmax(0,1fr)_360px] gap-8 px-8 pt-6 pb-32">
        <section>
          {/* Back */}
          <Link href="/coordinator/inbox" className="text-[13px] text-ink-4 hover:text-ink no-underline inline-flex items-center gap-1 mb-3">
            ← Back to inbox
          </Link>

          {/* Student summary card */}
          <div className="ug-card p-5 mb-5">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-ink font-semibold text-base">
                {studentInitials(sp?.full_name)}
              </div>
              <div className="flex-1">
                <div className="text-[18px] font-semibold text-ink">{sp?.full_name ?? "Unknown student"}</div>
                <div className="text-[13px] text-ink-3 mt-0.5 flex items-center gap-2 flex-wrap">
                  {sp?.matric_no && <span className="mono">{sp.matric_no}</span>}
                  {sp?.faculty && <><span className="w-1 h-1 rounded-full bg-ink-5" /><span>{sp.faculty}</span></>}
                  {sp?.programme && <><span className="w-1 h-1 rounded-full bg-ink-5" /><span>{sp.programme}</span></>}
                  {sp?.year && <><span className="w-1 h-1 rounded-full bg-ink-5" /><span>Year {sp.year}</span></>}
                  {sp?.cgpa !== null && sp?.cgpa !== undefined && <><span className="w-1 h-1 rounded-full bg-ink-5" /><span className={`mono font-semibold ${sp.cgpa < 3.3 ? "text-amber" : ""}`}>CGPA {sp.cgpa.toFixed(2)}</span></>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] text-ink-4">Submitted</div>
                <div className="text-[13px] mono text-ink-2 mt-0.5">
                  {data.application.submitted_at ? new Date(data.application.submitted_at).toLocaleString("en-MY") : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* AI Briefing */}
          {data.briefing && (
            <div className="ug-card mb-5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-line-2 bg-ai-tint">
                <div className="flex items-center gap-2.5 text-ai-ink font-semibold text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l2.35 5.6L20 8l-4 4 1.1 5.9L12 15.5 6.9 17.9 8 12 4 8l5.65-.4z" />
                  </svg>
                  AI Briefing
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`ug-rec ${data.briefing.recommendation === "approve" ? "approve" : data.briefing.recommendation === "reject" ? "reject" : "review"}`}>
                    Recommends: {data.briefing.recommendation === "approve" ? "Approve" : data.briefing.recommendation === "reject" ? "Reject" : "Request Info"}
                  </span>
                  {typeof data.application.ai_confidence === "number" && (
                    <ConfidenceTag value={data.application.ai_confidence} />
                  )}
                </div>
              </div>

              {/* Reasoning */}
              <div className="px-5 py-4 border-b border-line-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-2">Reasoning</div>
                <p className="text-[14px] text-ink-2 leading-relaxed m-0">{data.briefing.reasoning}</p>
              </div>

              {/* Extracted facts */}
              <div className="px-5 py-4 border-b border-line-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-3">Extracted facts</div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {Object.entries(data.briefing.extracted_facts).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[12px] text-ink-4">{k}</dt>
                      <dd className="text-[14px] font-medium text-ink mt-0.5 m-0">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Flags */}
              {data.briefing.flags.length > 0 && (
                <div className="px-5 py-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-2.5">Flags</div>
                  <ul className="flex flex-col gap-2">
                    {data.briefing.flags.map((f, i) => (
                      <li key={i} className={`text-[13px] flex items-start gap-2.5 px-3 py-2 rounded-lg ${
                        f.severity === "block" ? "bg-crimson-soft text-crimson border border-[#E8C5CB]" :
                        f.severity === "warn" ? "bg-amber-soft text-amber border border-[#E8DBB5]" :
                        "bg-ai-tint text-ai-ink border border-ai-line"
                      }`}>
                        <span className="font-bold uppercase text-[10.5px] tracking-wider mt-0.5">{f.severity}</span>
                        <span className="flex-1">{f.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Application steps */}
          <div className="ug-card mb-5 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2 flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-ink-3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Application steps
              </div>
              <span className="text-[12px] text-ink-4 mono">{data.steps.length} steps</span>
            </div>
            <div>
              {data.steps.map((s) => (
                <div key={s.id} className="px-5 py-4 border-b border-line-2 last:border-b-0">
                  <div className="flex items-start gap-4">
                    <div className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold flex-shrink-0 ${
                      s.status === "completed" ? "bg-moss-soft text-moss" : "bg-line-2 text-ink-3"
                    }`}>
                      {s.status === "completed" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : s.ordinal}
                    </div>
                    <div className="flex-1">
                      <div className="text-[14px] font-medium text-ink-2 mb-1.5">{s.prompt_text}</div>
                      {s.response_data && (
                        <div className="bg-paper-2 rounded-lg px-3 py-2 text-[13px] text-ink-2 leading-snug">
                          <span className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-4 block mb-1">Student response</span>
                          {renderResponse(s)}
                        </div>
                      )}
                    </div>
                    {s.emitted_by === "coordinator" && (
                      <span className="ug-pill" style={{ background: "var(--crimson-soft)", color: "var(--crimson)", borderColor: "#E8C5CB", padding: "3px 8px", fontSize: "11px" }}>
                        From you
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Letters delivered */}
          {data.letters.length > 0 && (
            <div className="ug-card mb-5 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-line-2 text-sm font-semibold">Letters delivered to student</div>
              {data.letters.map((l) => (
                <div key={l.id} className="px-5 py-4 border-b border-line-2 last:border-b-0">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-2">{l.letter_type.replace(/_/g, " ")}</div>
                  <pre className="text-[13px] text-ink-2 whitespace-pre-wrap font-sans leading-snug">{l.generated_text}</pre>
                </div>
              ))}
            </div>
          )}

          {/* Decision history */}
          {data.decisions.length > 0 && (
            <div className="ug-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-line-2 text-sm font-semibold">Decision history</div>
              {data.decisions.map((d) => (
                <div key={d.id} className="px-5 py-3 border-b border-line-2 last:border-b-0 flex items-center gap-3">
                  <span className={`ug-rec ${d.decision === "approve" ? "approve" : d.decision === "reject" ? "reject" : "review"}`}>
                    {d.decision === "approve" ? "Approved" : d.decision === "reject" ? "Rejected" : "Requested info"}
                  </span>
                  {d.comment && <span className="text-[13px] text-ink-3 flex-1">{d.comment}</span>}
                  <span className="text-[12px] text-ink-4 mono">{new Date(d.decided_at).toLocaleString("en-MY")}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right rail: action panel */}
        <aside className="sticky top-[84px] self-start">
          <div className="ug-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2 text-sm font-semibold">Decide on this application</div>
            <div className="p-5 space-y-3">
              <label className="block">
                <span className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">
                  Comment to student <span className="font-normal lowercase tracking-normal text-ink-4">(optional for approve, required for reject / request info)</span>
                </span>
                <textarea
                  className="ug-textarea mt-1.5 min-h-[140px]"
                  placeholder="Type your message — this is included in the letter sent to the student."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>

              <button
                className="ug-btn moss w-full justify-center gap-2"
                onClick={() => openPreview("approve")}
                disabled={busy !== null || decided || previewBusy}
              >
                <Check className="h-4 w-4" strokeWidth={2.25} />Preview & approve
              </button>
              <button
                className="ug-btn w-full justify-center gap-2"
                onClick={requestInfo}
                disabled={busy !== null}
                style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "#E8DBB5" }}
              >
                {busy === "request_info" ? "Requesting…" : (<><MessageSquare className="h-4 w-4" strokeWidth={1.85} />Request more info</>)}
              </button>
              <button
                className="ug-btn crimson w-full justify-center gap-2"
                onClick={() => openPreview("reject")}
                disabled={busy !== null || decided || previewBusy}
              >
                <X className="h-4 w-4" strokeWidth={2.25} />Preview & reject
              </button>
              <p className="text-[11px] text-ink-4 text-center pt-1">
                You'll see the letter and can edit it before it's sent.
              </p>

              {decided && (
                <p className="text-[12px] text-ink-4 italic">This application has already been decided. Letters are visible above.</p>
              )}
            </div>
          </div>
        </aside>
      </main>

      {previewKind && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => previewBusy ? null : setPreviewKind(null)}>
          <div className="ug-card w-full max-w-[760px] max-h-[88vh] overflow-hidden flex flex-col shadow-ug-lift" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-line-2 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">
                  Preview · {previewKind === "approve" ? "Acceptance" : "Rejection"} letter
                </div>
                <div className="text-[18px] font-semibold mt-0.5">
                  Review what the student will see
                </div>
                {previewMeta && (
                  <div className="text-[12px] text-ink-4 mt-1.5 mono">
                    template: {previewMeta.template_name}
                    {previewMeta.unfilled.length > 0 && (
                      <span className="ml-2 text-amber font-semibold">
                        · {previewMeta.unfilled.length} unfilled placeholder{previewMeta.unfilled.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                className="ug-btn ghost"
                onClick={() => setPreviewKind(null)}
                disabled={previewBusy || busy !== null}
              >
                Cancel
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {previewBusy ? (
                <div className="text-center py-8 text-ink-4">Generating preview…</div>
              ) : previewError ? (
                <div className="px-4 py-3 rounded-[10px] bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
                  {previewError}
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">
                      Editable letter — your changes are sent verbatim
                    </span>
                    <textarea
                      className="ug-textarea mt-1.5 min-h-[340px] text-[13.5px] leading-relaxed font-sans"
                      value={previewLetter}
                      onChange={(e) => setPreviewLetter(e.target.value)}
                      disabled={busy !== null}
                    />
                  </label>
                  {previewMeta && previewMeta.unfilled.length > 0 && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-amber-soft border border-[#E8DBB5] text-[12px] text-amber">
                      The AI couldn't fill: {previewMeta.unfilled.map((p) => `{{${p}}}`).join(", ")}. Edit them in the text above before sending.
                    </div>
                  )}
                </>
              )}
            </div>

            {!previewBusy && !previewError && (
              <div className="px-6 py-4 border-t border-line-2 flex items-center justify-between gap-3">
                <div className="text-[12px] text-ink-4">
                  Once sent, the letter is delivered to the student immediately.
                </div>
                <button
                  className={`ug-btn ${previewKind === "approve" ? "moss" : "crimson"} gap-2`}
                  onClick={confirmDecision}
                  disabled={busy !== null || !previewLetter.trim()}
                >
                  {busy ? `${previewKind === "approve" ? "Approving" : "Rejecting"}…` : (
                    <>
                      {previewKind === "approve"
                        ? <><Check className="h-4 w-4" strokeWidth={2.25} />Confirm & send acceptance</>
                        : <><X className="h-4 w-4" strokeWidth={2.25} />Confirm & send rejection</>}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function studentInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).map(p => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

function ConfidenceTag({ value }: { value: number }) {
  const { label, color, bg } = (() => {
    if (value >= 0.85) return { label: "Very confident", color: "var(--moss)", bg: "var(--moss-soft)" };
    if (value >= 0.70) return { label: "Confident", color: "var(--moss)", bg: "var(--moss-soft)" };
    if (value >= 0.50) return { label: "Borderline", color: "var(--amber)", bg: "var(--amber-soft)" };
    return { label: "Review carefully", color: "var(--crimson)", bg: "var(--crimson-soft)" };
  })();
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold"
      style={{ background: bg, color }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
      <span className="opacity-60 mono font-medium">{value.toFixed(2)}</span>
    </span>
  );
}

function renderResponse(s: { type: string; response_data: Record<string, unknown> | null }): React.ReactNode {
  const r = s.response_data;
  if (!r) return <span className="italic text-ink-4">no response</span>;
  if (typeof r.text === "string") return <span className="whitespace-pre-wrap">{r.text}</span>;
  if (typeof r.filename === "string") {
    const path = typeof r.storage_path === "string" ? r.storage_path : null;
    return path
      ? <FileViewLink filename={r.filename} path={path} size={typeof r.size === "number" ? r.size : undefined} />
      : (
        <span className="inline-flex items-center gap-1.5 text-ink-4 italic">
          <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
          {r.filename} <span className="text-[11px]">(legacy — file not stored)</span>
        </span>
      );
  }
  if (Array.isArray(r.values)) return <span>{(r.values as string[]).join(", ")}</span>;
  if (typeof r.value === "string") return <span>{r.value}</span>;
  if (r.confirmed) return <span className="text-moss font-medium">Confirmed</span>;
  if (r.acknowledged) return <span className="text-moss font-medium">Acknowledged</span>;
  return <span className="mono text-[12px]">{JSON.stringify(r)}</span>;
}

function FileViewLink({ filename, path, size }: { filename: string; path: string; size?: number }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    setOpening(true);
    try {
      const res = await fetch(`/api/files/sign?path=${encodeURIComponent(path)}`);
      const json = await res.json();
      if (json.ok) {
        window.open(json.data.url, "_blank", "noopener,noreferrer");
      } else {
        alert(`Could not open file: ${json.error}`);
      }
    } catch (err) {
      alert(`Could not open file: ${err instanceof Error ? err.message : "network error"}`);
    } finally {
      setOpening(false);
    }
  };
  const sizeLabel = size ? formatFileSize(size) : null;
  return (
    <button
      type="button"
      onClick={open}
      disabled={opening}
      className="inline-flex items-center gap-1.5 text-crimson hover:underline disabled:opacity-60"
    >
      <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span className="font-medium">{filename}</span>
      {sizeLabel && <span className="text-[11px] text-ink-4 mono">{sizeLabel}</span>}
      <span className="text-[11px] text-ink-4">{opening ? "Opening…" : "(view)"}</span>
    </button>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
