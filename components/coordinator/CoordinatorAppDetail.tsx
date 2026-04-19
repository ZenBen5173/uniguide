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
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

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

  const decide = async (decision: "approve" | "reject" | "request_info") => {
    if (decision === "request_info" && !comment.trim()) {
      alert("Please type what you'd like the student to provide.");
      return;
    }
    setBusy(decision);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment.trim() || undefined }),
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
                <span className={`ug-rec ${data.briefing.recommendation === "approve" ? "approve" : data.briefing.recommendation === "reject" ? "reject" : "review"}`}>
                  Recommends: {data.briefing.recommendation === "approve" ? "Approve" : data.briefing.recommendation === "reject" ? "Reject" : "Request Info"}
                </span>
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
                onClick={() => decide("approve")}
                disabled={busy !== null || decided}
              >
                {busy === "approve" ? "Approving…" : (<><Check className="h-4 w-4" strokeWidth={2.25} />Approve · generate acceptance letter</>)}
              </button>
              <button
                className="ug-btn w-full justify-center gap-2"
                onClick={() => decide("request_info")}
                disabled={busy !== null}
                style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "#E8DBB5" }}
              >
                {busy === "request_info" ? "Requesting…" : (<><MessageSquare className="h-4 w-4" strokeWidth={1.85} />Request more info</>)}
              </button>
              <button
                className="ug-btn crimson w-full justify-center gap-2"
                onClick={() => decide("reject")}
                disabled={busy !== null || decided}
              >
                {busy === "reject" ? "Rejecting…" : (<><X className="h-4 w-4" strokeWidth={2.25} />Reject · generate rejection letter</>)}
              </button>

              {decided && (
                <p className="text-[12px] text-ink-4 italic">This application has already been decided. Letters are visible above.</p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </>
  );
}

function studentInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).map(p => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

function renderResponse(s: { type: string; response_data: Record<string, unknown> | null }): React.ReactNode {
  const r = s.response_data;
  if (!r) return <span className="italic text-ink-4">no response</span>;
  if (typeof r.text === "string") return <span className="whitespace-pre-wrap">{r.text}</span>;
  if (typeof r.filename === "string") return (
    <span className="inline-flex items-center gap-1.5">
      <Paperclip className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.75} />
      {r.filename}
    </span>
  );
  if (Array.isArray(r.values)) return <span>{(r.values as string[]).join(", ")}</span>;
  if (typeof r.value === "string") return <span>{r.value}</span>;
  if (r.confirmed) return <span className="text-moss font-medium">Confirmed</span>;
  if (r.acknowledged) return <span className="text-moss font-medium">Acknowledged</span>;
  return <span className="mono text-[12px]">{JSON.stringify(r)}</span>;
}
