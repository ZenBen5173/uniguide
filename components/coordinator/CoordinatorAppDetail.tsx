"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, X, Paperclip, Undo2, Sparkles } from "lucide-react";
import TopBar from "@/components/shared/TopBar";
import InternalNotes from "@/components/coordinator/InternalNotes";
import MessageThread from "@/components/shared/MessageThread";
import AiProgressBar from "@/components/shared/AiProgressBar";
import { useSilentRefresh } from "@/lib/hooks/useSilentRefresh";

const FACT_ACRONYMS = new Set([
  "cgpa", "ug", "epf", "rm", "fyp", "ic", "spm", "stpm",
  "muet", "ielts", "toefl", "b40", "m40", "t20", "um", "mara", "ai",
]);
const FACT_QUALIFIER = /_(inferred|verified|declared|estimated|reported)$/;

function formatFactLabel(key: string): string {
  let base = key.replace(/_rm$/, "");
  let qualifier = "";
  const qm = base.match(FACT_QUALIFIER);
  if (qm) {
    qualifier = ` (${qm[1]})`;
    base = base.slice(0, -qm[0].length);
  }
  const words = base.split("_").map((w, i) => {
    if (FACT_ACRONYMS.has(w.toLowerCase())) return w.toUpperCase();
    if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return w.toLowerCase();
  });
  return words.join(" ") + qualifier;
}

function formatFactValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (/_rm$/.test(key)) return `RM ${value.toLocaleString("en-MY")}`;
    if (Number.isInteger(value) && Math.abs(value) >= 1000) return value.toLocaleString("en-MY");
    return String(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

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
    assigned_to: string | null;
    assignee_name: string | null;
    escalation_pending?: boolean | null;
    escalation_opened_at?: string | null;
    escalation_resolved_at?: string | null;
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
  escalation_summary?: string | null;
  viewer?: { id: string };
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
  // What the spinner banner says — stages give the coordinator something
  // useful to read instead of a silent "Generating preview…".
  const [previewStage, setPreviewStage] = useState<
    "idle" | "drafting" | "judging" | "done"
  >("idle");
  const [previewLetter, setPreviewLetter] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  type JudgeIssue = {
    severity: "info" | "warn" | "block";
    category: string;
    message: string;
    excerpt: string | null;
  };
  const [previewMeta, setPreviewMeta] = useState<{
    template_name: string;
    unfilled: string[];
    issues: Array<{ severity: "warn" | "block"; field: string; message: string }>;
    judge_issues: JudgeIssue[];
    judge_assessment: string | null;
    judge_confidence: number | null;
    judge_available: boolean;
  } | null>(null);

  // Step-preview modal state (Request More Info flow — plan-mode confirmation)
  const [stepPreviewOpen, setStepPreviewOpen] = useState(false);
  const [stepPreviewBusy, setStepPreviewBusy] = useState(false);
  const [stepPreviewError, setStepPreviewError] = useState<string | null>(null);
  const [stepPreview, setStepPreview] = useState<{
    type: string;
    prompt_text: string;
    config: Record<string, unknown>;
    reasoning: string;
    citations: string[];
  } | null>(null);

  // Coassist state — natural-language "tweak this" for letter / step / briefing.
  // Per-artifact instruction draft and turn history so each modal/panel keeps
  // its own thread independently.
  type CoassistArtifact = "letter" | "step_prompt" | "briefing_reasoning";
  const [coassistInstruction, setCoassistInstruction] = useState<Record<CoassistArtifact, string>>({
    letter: "",
    step_prompt: "",
    briefing_reasoning: "",
  });
  const [coassistTurns, setCoassistTurns] = useState<
    Record<CoassistArtifact, Array<{ role: "coordinator" | "ai"; text: string }>>
  >({
    letter: [],
    step_prompt: [],
    briefing_reasoning: [],
  });
  const [coassistBusy, setCoassistBusy] = useState<CoassistArtifact | null>(null);
  const [coassistError, setCoassistError] = useState<Record<CoassistArtifact, string | null>>({
    letter: null,
    step_prompt: null,
    briefing_reasoning: null,
  });
  const [coassistExplanation, setCoassistExplanation] = useState<
    Record<CoassistArtifact, string | null>
  >({
    letter: null,
    step_prompt: null,
    briefing_reasoning: null,
  });
  // Briefing-coassist drawer visibility
  const [briefingCoassistOpen, setBriefingCoassistOpen] = useState(false);

  // Briefing regeneration. Submit-time generateBriefing can fail when Z.AI
  // is slow — the submit route writes a fallback briefing so the student
  // isn't blocked, but the coordinator gets a confidence-0 fallback that
  // says "AI briefing failed to generate". This button re-runs the GLM
  // call now, when load may have eased, and inserts a fresh briefing row.
  const [regeneratingBriefing, setRegeneratingBriefing] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const regenerateBriefing = async () => {
    setRegeneratingBriefing(true);
    setRegenerateError(null);
    try {
      const res = await fetch(
        `/api/coordinator/applications/${id}/regenerate-briefing`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!json.ok) {
        setRegenerateError(json.error ?? "Could not regenerate briefing.");
        return;
      }
      await refresh();
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRegeneratingBriefing(false);
    }
  };

  // Escalation resolution
  const [resolvingEscalation, setResolvingEscalation] = useState(false);
  const resolveEscalation = async () => {
    if (!confirm("Mark this escalation as resolved? The chat thread is preserved.")) return;
    setResolvingEscalation(true);
    try {
      const res = await fetch(
        `/api/coordinator/applications/${id}/resolve-escalation`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const json = await res.json();
      if (json.ok) {
        await refresh();
      } else {
        alert(`Could not resolve: ${json.error}`);
      }
    } finally {
      setResolvingEscalation(false);
    }
  };

  /** Run coassist on the given artifact. onRevised gets the new text so the
   *  caller can update its local state (e.g. setPreviewLetter). For
   *  briefing_reasoning the call is Q&A-only; we don't update any record. */
  const runCoassist = async (
    artifact: CoassistArtifact,
    currentText: string,
    onRevised:
      | ((
          newText: string,
          hallucinationIssues?: Array<{ severity: "warn" | "block"; field: string; message: string }>,
          judgeMeta?: {
            judge_issues: JudgeIssue[];
            judge_assessment: string | null;
            judge_confidence: number | null;
            judge_available: boolean;
          }
        ) => void)
      | null,
    decisionKind?: "approve" | "reject" | "request_info"
  ) => {
    const instruction = coassistInstruction[artifact].trim();
    if (!instruction) return;
    setCoassistBusy(artifact);
    setCoassistError({ ...coassistError, [artifact]: null });
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/coassist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          current_text: currentText,
          instruction,
          prior_turns: coassistTurns[artifact],
          decision_kind: decisionKind,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setCoassistError({ ...coassistError, [artifact]: json.error ?? "Could not revise." });
        return;
      }
      // Push the turn pair into the history.
      setCoassistTurns({
        ...coassistTurns,
        [artifact]: [
          ...coassistTurns[artifact],
          { role: "coordinator", text: instruction },
          { role: "ai", text: json.data.brief_explanation },
        ],
      });
      setCoassistExplanation({
        ...coassistExplanation,
        [artifact]: json.data.brief_explanation,
      });
      setCoassistInstruction({ ...coassistInstruction, [artifact]: "" });
      if (onRevised)
        onRevised(json.data.revised_text, json.data.hallucination_issues, {
          judge_issues: json.data.judge_issues ?? [],
          judge_assessment: json.data.judge_assessment ?? null,
          judge_confidence: json.data.judge_confidence ?? null,
          judge_available: !!json.data.judge_available,
        });
    } catch (err) {
      setCoassistError({
        ...coassistError,
        [artifact]: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setCoassistBusy(null);
    }
  };

  // Undo countdown (re-renders every second when decision is recent)
  const [, setUndoTick] = useState(0);
  const [undoBusy, setUndoBusy] = useState(false);

  // Claim/release
  const [claimBusy, setClaimBusy] = useState(false);

  // AI-suggest comment
  const [suggestBusy, setSuggestBusy] = useState<"request_info" | "approve" | "reject" | null>(null);

  const suggestComment = async (intent: "request_info" | "approve" | "reject") => {
    setSuggestBusy(intent);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/suggest-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const json = await res.json();
      if (json.ok) {
        setComment(json.data.suggested_comment);
      } else {
        alert(`Suggest failed: ${json.error}`);
      }
    } finally {
      setSuggestBusy(null);
    }
  };

  const claim = async () => {
    setClaimBusy(true);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/claim`, { method: "POST" });
      if (res.ok) await refresh();
    } finally {
      setClaimBusy(false);
    }
  };
  const release = async () => {
    setClaimBusy(true);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/claim`, { method: "DELETE" });
      if (res.ok) await refresh();
    } finally {
      setClaimBusy(false);
    }
  };

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

  // Silent re-fetch every 20s + on tab focus / visibility. Catches the case
  // where the student responds to a request_info or sends a chat message
  // while the coordinator has the detail page open — without this, briefings
  // / new steps / message threads stay stale until manual refresh.
  useSilentRefresh(refresh, 20_000);

  const openPreview = async (kind: "approve" | "reject") => {
    setPreviewKind(kind);
    setPreviewBusy(true);
    setPreviewError(null);
    setPreviewLetter("");
    setPreviewMeta(null);
    setPreviewStage("drafting");

    // Stage advance: ~12 s after kicking off the call, swap the banner
    // copy to "judging" so the coordinator knows the second pass is
    // running. The server enforces a 15 s judge timeout and the route's
    // own 60 s ceiling, so this is purely a UI hint.
    const stageTimer = setTimeout(() => setPreviewStage("judging"), 12_000);

    // Client-side timeout — kill the fetch at 55 s so the modal returns
    // an error instead of spinning forever if the server hits its 60 s
    // ceiling without responding. AbortController also cancels the
    // network request rather than just stopping the await.
    const controller = new AbortController();
    const fetchTimer = setTimeout(() => controller.abort(), 55_000);

    try {
      const res = await fetch(`/api/coordinator/applications/${id}/preview-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: kind, comment: comment.trim() || undefined }),
        signal: controller.signal,
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
        issues: json.data.hallucination_issues ?? [],
        judge_issues: json.data.judge_issues ?? [],
        judge_assessment: json.data.judge_assessment ?? null,
        judge_confidence: json.data.judge_confidence ?? null,
        judge_available: !!json.data.judge_available,
      });
      setPreviewStage("done");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setPreviewError(
          "Generating the preview is taking longer than usual. Z.AI may be slow right now — please wait a moment and try again."
        );
      } else {
        setPreviewError(err instanceof Error ? err.message : "Network error");
      }
    } finally {
      clearTimeout(stageTimer);
      clearTimeout(fetchTimer);
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

  // Tick once a second so the undo countdown updates without a full refetch.
  useEffect(() => {
    if (!data?.application.decided_at) return;
    const ageMs = Date.now() - new Date(data.application.decided_at).getTime();
    if (ageMs > 5 * 60 * 1000) return;
    const t = setInterval(() => setUndoTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [data?.application.decided_at]);

  const undo = async () => {
    if (!confirm("Undo this decision? The letter sent to the student will be removed and the application returns to your queue.")) return;
    setUndoBusy(true);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/undo`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) {
        alert(`Could not undo: ${json.error}`);
        return;
      }
      await refresh();
    } finally {
      setUndoBusy(false);
    }
  };

  /**
   * Plan-mode-style flow: show what the AI proposes to ask the student
   * BEFORE it commits. Coordinator can edit the prompt_text or cancel.
   * On AI/network failure, fall back to the legacy direct-fire path so
   * coordinators are never blocked.
   */
  const openStepPreview = async () => {
    if (!comment.trim()) {
      alert("Please type what you'd like the student to provide.");
      return;
    }
    setStepPreviewOpen(true);
    setStepPreviewBusy(true);
    setStepPreviewError(null);
    setStepPreview(null);
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/preview-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        setStepPreviewError(json.error ?? "Could not generate preview.");
        return;
      }
      setStepPreview({
        type: json.data.proposed_step.type,
        prompt_text: json.data.proposed_step.prompt_text,
        config: json.data.proposed_step.config ?? {},
        reasoning: json.data.reasoning ?? "",
        citations: json.data.citations ?? [],
      });
    } catch (err) {
      setStepPreviewError(err instanceof Error ? err.message : "Network error");
    } finally {
      setStepPreviewBusy(false);
    }
  };

  const confirmStepRequest = async () => {
    if (!stepPreview) return;
    setBusy("request_info");
    try {
      const res = await fetch(`/api/coordinator/applications/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "request_info",
          comment: comment.trim(),
          step_override: {
            type: stepPreview.type,
            prompt_text: stepPreview.prompt_text,
            config: stepPreview.config,
          },
        }),
      });
      const json = await res.json();
      if (json.ok) {
        await refresh();
        setComment("");
        setStepPreviewOpen(false);
        setStepPreview(null);
      } else {
        alert(`Could not send: ${json.error}`);
      }
    } finally {
      setBusy(null);
    }
  };

  /**
   * Legacy direct-fire path — kept as a fallback when the AI preview
   * is unavailable (provider down or schema error). Same behaviour as
   * before this PR: AI plans the step inline during the decide call.
   */
  const requestInfoFallback = async () => {
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
        setStepPreviewOpen(false);
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) return (<><TopBar user={user} roleChip={{ label: "Coordinator" }} /><main className="p-12 text-ink-4">Loading…</main></>);
  if (!data) return (<><TopBar user={user} roleChip={{ label: "Coordinator" }} /><main className="p-12 text-crimson">Application not found</main></>);

  const sp = data.application.student_profiles;
  const decided = data.application.decided_at !== null;
  const isDraft = data.application.status === "draft";

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

          {/* Escalation context — surfaces when the student has flagged that
               they need a coordinator's attention. The application's status
               is unchanged; the escalation is parallel to the formal flow. */}
          {data.application.escalation_pending && data.escalation_summary && (
            <div className="ug-card mb-5 overflow-hidden border-[#E8DBB5]" style={{ borderColor: "#E8DBB5" }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8DBB5] bg-amber-soft">
                <div className="flex items-center gap-2.5 text-amber font-semibold text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v3.5M12 16h.01M5.07 19h13.86a2 2 0 0 0 1.74-3l-6.93-12a2 2 0 0 0-3.48 0l-6.93 12a2 2 0 0 0 1.74 3z" />
                  </svg>
                  Student escalation
                </div>
                <button
                  className="ug-btn ghost text-[12px]"
                  onClick={resolveEscalation}
                  disabled={resolvingEscalation}
                >
                  {resolvingEscalation ? "Resolving…" : "Mark resolved"}
                </button>
              </div>
              <div className="px-5 py-4">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-1.5">
                  AI summary of the student's situation
                </div>
                <p className="text-[14px] text-ink-2 leading-relaxed m-0">
                  {data.escalation_summary}
                </p>
                {data.application.escalation_opened_at && (
                  <div className="text-[11.5px] text-ink-4 mt-2 mono">
                    opened {new Date(data.application.escalation_opened_at).toLocaleString("en-MY")}
                  </div>
                )}
                <div className="text-[12px] text-ink-3 mt-3 italic">
                  Reply in the message thread on the right to respond. The student sees your message in real time.
                </div>
              </div>
            </div>
          )}

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
                <div className="flex items-center gap-3">
                  <button
                    className="text-[11px] inline-flex items-center gap-1 text-ai-ink hover:underline disabled:opacity-50"
                    onClick={regenerateBriefing}
                    disabled={regeneratingBriefing}
                    title="Re-run the AI briefing now (useful when the submit-time briefing fell back due to slow Z.AI)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={regeneratingBriefing ? "animate-spin" : ""}>
                      <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
                      <path d="M3 21v-5h5" />
                    </svg>
                    {regeneratingBriefing ? "Regenerating…" : "Regenerate"}
                  </button>
                  <button
                    className="text-[11px] inline-flex items-center gap-1 text-ai-ink hover:underline"
                    onClick={() => setBriefingCoassistOpen(true)}
                    title="Ask the AI about this briefing"
                  >
                    <Sparkles className="h-3 w-3" strokeWidth={2.25} />
                    Ask the AI
                  </button>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`ug-rec ${data.briefing.recommendation === "approve" ? "approve" : data.briefing.recommendation === "reject" ? "reject" : "review"}`}>
                      Recommends: {data.briefing.recommendation === "approve" ? "Approve" : data.briefing.recommendation === "reject" ? "Reject" : "Request Info"}
                    </span>
                    {typeof data.application.ai_confidence === "number" && (
                      <ConfidenceTag value={data.application.ai_confidence} />
                    )}
                  </div>
                </div>
              </div>

              {regeneratingBriefing && (
                <div className="px-5 py-3 border-b border-line-2 bg-ai-tint">
                  <AiProgressBar
                    expectedMs={25_000}
                    compact
                    stages={[
                      { at: 0, label: "Re-reading the application history…" },
                      { at: 8, label: "Cross-referencing with the SOP…" },
                      { at: 18, label: "Drafting the briefing…" },
                    ]}
                  />
                </div>
              )}

              {regenerateError && (
                <div className="px-5 py-3 border-b border-line-2 bg-crimson-soft text-[12.5px] text-crimson">
                  {regenerateError}
                </div>
              )}

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
                      <dt className="text-[12px] text-ink-4">{formatFactLabel(k)}</dt>
                      <dd className="text-[14px] font-medium text-ink mt-0.5 m-0">
                        {formatFactValue(k, v)}
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{l.letter_type.replace(/_/g, " ")}</div>
                    <Link
                      href={`/letters/${l.id}/print`}
                      target="_blank"
                      className="text-[11px] text-crimson hover:underline no-underline font-medium"
                    >
                      Open / Print →
                    </Link>
                  </div>
                  <pre className="text-[13px] text-ink-2 whitespace-pre-wrap font-sans leading-snug">{l.generated_text}</pre>
                </div>
              ))}
            </div>
          )}

          {/* Decision history */}
          {data.decisions.length > 0 && (
            <div className="ug-card overflow-hidden mb-5">
              <div className="px-5 py-3.5 border-b border-line-2 text-sm font-semibold">Decision history</div>
              {data.decisions.map((d) => (
                <div key={d.id} className="px-5 py-3 border-b border-line-2 last:border-b-0 flex items-center gap-3">
                  <span className={`ug-rec ${d.decision === "approve" ? "approve" : d.decision === "reject" ? "reject" : d.decision === "withdrawn" ? "" : "review"}`} style={d.decision === "withdrawn" ? { background: "var(--line-2)", color: "var(--ink-4)", borderColor: "var(--line)" } : undefined}>
                    {d.decision === "approve" ? "Approved" : d.decision === "reject" ? "Rejected" : d.decision === "withdrawn" ? "Withdrawn by student" : "Requested info"}
                  </span>
                  {d.comment && <span className="text-[13px] text-ink-3 flex-1">{d.comment}</span>}
                  <span className="text-[12px] text-ink-4 mono">{new Date(d.decided_at).toLocaleString("en-MY")}</span>
                </div>
              ))}
            </div>
          )}

          {/* Message thread with student */}
          <div className="mb-5">
            <MessageThread applicationId={id} variant="panel" />
          </div>

          {/* Internal notes (staff-only) */}
          <InternalNotes applicationId={id} />
        </section>

        {/* Right rail: action panel */}
        <aside className="sticky top-[84px] self-start space-y-3">
          {/* Draft banner */}
          {isDraft && (
            <div className="ug-card p-4 border-amber" style={{ background: "var(--amber-soft)" }}>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-amber mb-1.5">
                Draft — read only
              </div>
              <p className="text-[12.5px] text-ink-2 leading-snug">
                The student is still working on this application. You can monitor progress here, but there's nothing to decide until they hit Submit.
              </p>
              <p className="text-[11.5px] text-ink-3 mt-2">
                {data.steps.filter(s => s.status === "completed").length} of ~{data.steps.length} steps completed.
              </p>
            </div>
          )}

          {/* Claim / assignee */}
          {!decided && !isDraft && (() => {
            const assignedTo = data.application.assigned_to;
            const viewerId = data.viewer?.id;
            const mine = assignedTo && viewerId && assignedTo === viewerId;
            const someone = assignedTo && !mine;
            return (
              <div className={`ug-card p-4 ${someone ? "border-amber" : ""}`}>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-2">Assigned to</div>
                {!assignedTo && (
                  <>
                    <p className="text-[13px] text-ink-3 mb-2.5">Nobody yet — claim this so other coordinators know it's in your lane.</p>
                    <button
                      className="ug-btn primary sm w-full justify-center"
                      onClick={claim}
                      disabled={claimBusy}
                    >
                      {claimBusy ? "Claiming…" : "Claim this application"}
                    </button>
                  </>
                )}
                {mine && (
                  <>
                    <p className="text-[13px] text-ink-2 mb-2.5"><span className="font-semibold">You</span> are reviewing this.</p>
                    <button
                      className="ug-btn ghost sm w-full justify-center"
                      onClick={release}
                      disabled={claimBusy}
                    >
                      {claimBusy ? "Releasing…" : "Release claim"}
                    </button>
                  </>
                )}
                {someone && (
                  <>
                    <p className="text-[13px] text-amber font-medium mb-1">{data.application.assignee_name} is reviewing this.</p>
                    <p className="text-[12px] text-ink-4 mb-2.5">You can still act on it, but check with them first to avoid duplicate work.</p>
                    <button
                      className="ug-btn ghost sm w-full justify-center"
                      onClick={claim}
                      disabled={claimBusy}
                    >
                      {claimBusy ? "Taking over…" : "Take over"}
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {!isDraft && (
          <div className="ug-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2 text-sm font-semibold">Decide on this application</div>
            <div className="p-5 space-y-3">
              <label className="block">
                <span className="block text-[12px] uppercase tracking-wider font-semibold text-ink-4 mb-1.5">
                  Comment to student
                </span>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span className="text-[10.5px] text-ink-4 mono">AI suggest:</span>
                  {(["request_info", "approve", "reject"] as const).map((intent) => (
                    <button
                      key={intent}
                      type="button"
                      onClick={() => suggestComment(intent)}
                      disabled={suggestBusy !== null}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-ai-line bg-ai-tint text-ai-ink hover:bg-card disabled:opacity-50 whitespace-nowrap"
                      title={`Draft a ${intent.replace("_", " ")} comment based on the AI briefing`}
                    >
                      <Sparkles className="h-2.5 w-2.5" strokeWidth={2.25} />
                      {suggestBusy === intent ? "…" : intent.replace("_", " ")}
                    </button>
                  ))}
                </div>
                <textarea
                  className="ug-textarea min-h-[140px]"
                  placeholder="Type your message, or use the AI suggest buttons above to draft one based on the briefing."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <span className="block text-[11px] text-ink-4 font-normal mt-1">Optional for approve, required for reject / request info. Goes verbatim into the letter.</span>
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
                onClick={openStepPreview}
                disabled={busy !== null || stepPreviewBusy}
                style={{ background: "var(--amber-soft)", color: "var(--amber)", borderColor: "#E8DBB5" }}
              >
                {busy === "request_info"
                  ? "Requesting…"
                  : stepPreviewBusy
                  ? "Planning…"
                  : (<><MessageSquare className="h-4 w-4" strokeWidth={1.85} />Preview info request</>)}
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

              {decided && (() => {
                const decidedAt = data.application.decided_at ? new Date(data.application.decided_at).getTime() : 0;
                const remainingMs = decidedAt + 5 * 60 * 1000 - Date.now();
                if (remainingMs <= 0) {
                  return (
                    <p className="text-[12px] text-ink-4 italic">
                      This application has already been decided. Letters are visible above.
                    </p>
                  );
                }
                const mm = Math.floor(remainingMs / 60000);
                const ss = Math.floor((remainingMs % 60000) / 1000);
                return (
                  <div className="rounded-[10px] border border-amber-soft bg-amber-soft/40 p-3">
                    <div className="text-[12px] font-semibold text-amber uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
                      Undo window · <span className="mono">{mm}:{ss.toString().padStart(2, "0")}</span> left
                    </div>
                    <p className="text-[12px] text-ink-3 leading-snug mb-2.5">
                      Made a mistake? You can undo this decision and remove the letter sent to the student.
                    </p>
                    <button
                      className="ug-btn w-full justify-center gap-2 sm"
                      style={{ background: "var(--card)", color: "var(--ink)", borderColor: "var(--line)" }}
                      onClick={undo}
                      disabled={undoBusy}
                    >
                      {undoBusy ? "Undoing…" : "Undo this decision"}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
          )}
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
                <AiProgressBar
                  expectedMs={30_000}
                  stages={[
                    { at: 0, label: "Drafting the letter from the template + briefing…" },
                    { at: 12, label: "Running the AI faithfulness check on the draft…" },
                  ]}
                  label={
                    previewStage === "judging"
                      ? "Running the AI faithfulness check on the draft…"
                      : null
                  }
                  caption="Z.AI calls usually take 10 to 30 seconds. If it's longer than a minute the modal will stop waiting and surface an error you can retry."
                />
              ) : previewError ? (
                <div className="space-y-3">
                  <div className="px-4 py-3 rounded-[10px] bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
                    {previewError}
                  </div>
                  <button
                    type="button"
                    className="ug-btn primary"
                    onClick={() => previewKind && openPreview(previewKind)}
                  >
                    Try again
                  </button>
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
                  {previewMeta && previewMeta.issues.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-crimson flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-crimson" />
                        Hallucination check (regex) · {previewMeta.issues.length} issue{previewMeta.issues.length === 1 ? "" : "s"}
                      </div>
                      {previewMeta.issues.map((issue, i) => (
                        <div
                          key={i}
                          className={`px-3 py-2 rounded-lg text-[12px] ${
                            issue.severity === "block"
                              ? "bg-crimson-soft border border-[#E8C5CB] text-crimson"
                              : "bg-amber-soft border border-[#E8DBB5] text-amber"
                          }`}
                        >
                          <span className="font-bold uppercase text-[10.5px] tracking-wider mr-1.5">{issue.severity}</span>
                          <span className="font-medium">{issue.field}:</span> {issue.message}
                        </div>
                      ))}
                      <div className="text-[11.5px] text-ink-4">
                        These are flagged so you can fix them in the editable text above before sending.
                      </div>
                    </div>
                  )}

                  {/* AI Judge — second-layer hallucination check by GLM. Reads
                       the letter against the briefing + SOP. Catches semantic
                       problems regex can't see (fabricated policy, contradicted
                       briefing, invented committee names). */}
                  {previewMeta && previewMeta.judge_available && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" strokeWidth={2.25} />
                        AI Judge {previewMeta.judge_issues.length > 0
                          ? `· ${previewMeta.judge_issues.length} finding${previewMeta.judge_issues.length === 1 ? "" : "s"}`
                          : "· no issues found"}
                        {previewMeta.judge_confidence !== null && (
                          <span className="ml-auto font-mono text-[10.5px] text-ink-4 normal-case tracking-normal">
                            confidence {(previewMeta.judge_confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>

                      {previewMeta.judge_assessment && (
                        <div className="px-3 py-2 rounded-lg text-[12px] bg-ai-tint border border-ai-line text-ink-2">
                          {previewMeta.judge_assessment}
                        </div>
                      )}

                      {previewMeta.judge_issues.map((issue, i) => (
                        <div
                          key={i}
                          className={`px-3 py-2 rounded-lg text-[12px] ${
                            issue.severity === "block"
                              ? "bg-crimson-soft border border-[#E8C5CB] text-crimson"
                              : issue.severity === "warn"
                                ? "bg-amber-soft border border-[#E8DBB5] text-amber"
                                : "bg-card-2 border border-line text-ink-3"
                          }`}
                        >
                          <span className="font-bold uppercase text-[10.5px] tracking-wider mr-1.5">{issue.severity}</span>
                          <span className="font-medium">{issue.category}:</span> {issue.message}
                          {issue.excerpt && (
                            <div className="mt-1 pl-2 border-l-2 border-current opacity-80 italic">
                              &ldquo;{issue.excerpt}&rdquo;
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="text-[11.5px] text-ink-4">
                        Independent GLM read of the letter against the briefing + SOP. Acts as a second pair of eyes alongside the regex layer above.
                      </div>
                    </div>
                  )}

                  {/* Coassist — "tweak this" via natural-language instruction */}
                  <div className="mt-5 pt-4 border-t border-line-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" strokeWidth={2.25} />
                      Revise with AI
                    </div>

                    {coassistTurns.letter.length > 0 && (
                      <div className="mb-2.5 space-y-1.5">
                        {coassistTurns.letter.map((t, i) => (
                          <div
                            key={i}
                            className={`text-[12px] px-3 py-1.5 rounded-lg ${
                              t.role === "coordinator"
                                ? "bg-card-2 text-ink-2 border border-line"
                                : "bg-ai-tint text-ink-2 border border-ai-line"
                            }`}
                          >
                            <span className="font-semibold mr-1.5">
                              {t.role === "coordinator" ? "You:" : "AI:"}
                            </span>
                            {t.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {coassistError.letter && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[12px] text-crimson">
                        {coassistError.letter}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="ug-input flex-1 text-[13px]"
                        placeholder="e.g. Make this softer · Add the appeal info · Shorten the second paragraph"
                        value={coassistInstruction.letter}
                        onChange={(e) =>
                          setCoassistInstruction({
                            ...coassistInstruction,
                            letter: e.target.value,
                          })
                        }
                        disabled={coassistBusy === "letter" || busy !== null}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void runCoassist(
                              "letter",
                              previewLetter,
                              (text, issues, judgeMeta) => {
                                setPreviewLetter(text);
                                if (previewMeta) {
                                  setPreviewMeta({
                                    ...previewMeta,
                                    issues: issues ?? previewMeta.issues,
                                    judge_issues: judgeMeta?.judge_issues ?? previewMeta.judge_issues,
                                    judge_assessment:
                                      judgeMeta?.judge_assessment ?? previewMeta.judge_assessment,
                                    judge_confidence:
                                      judgeMeta?.judge_confidence ?? previewMeta.judge_confidence,
                                    judge_available:
                                      judgeMeta?.judge_available ?? previewMeta.judge_available,
                                  });
                                }
                              },
                              previewKind ?? undefined
                            );
                          }
                        }}
                      />
                      <button
                        className="ug-btn gap-1.5"
                        style={{
                          background: "var(--ai-tint)",
                          color: "var(--ai-ink)",
                          borderColor: "var(--ai-line)",
                        }}
                        onClick={() =>
                          runCoassist(
                            "letter",
                            previewLetter,
                            (text, issues, judgeMeta) => {
                              setPreviewLetter(text);
                              if (previewMeta) {
                                setPreviewMeta({
                                  ...previewMeta,
                                  issues: issues ?? previewMeta.issues,
                                  judge_issues:
                                    judgeMeta?.judge_issues ?? previewMeta.judge_issues,
                                  judge_assessment:
                                    judgeMeta?.judge_assessment ?? previewMeta.judge_assessment,
                                  judge_confidence:
                                    judgeMeta?.judge_confidence ?? previewMeta.judge_confidence,
                                  judge_available:
                                    judgeMeta?.judge_available ?? previewMeta.judge_available,
                                });
                              }
                            },
                            previewKind ?? undefined
                          )
                        }
                        disabled={
                          coassistBusy === "letter" ||
                          busy !== null ||
                          !coassistInstruction.letter.trim()
                        }
                      >
                        {coassistBusy === "letter" ? "Revising…" : "Revise"}
                      </button>
                    </div>

                    {coassistBusy === "letter" && (
                      <div className="mt-2">
                        <AiProgressBar
                          expectedMs={25_000}
                          compact
                          stages={[
                            { at: 0, label: "Revising the letter…" },
                            { at: 12, label: "Re-checking against SOP + briefing…" },
                          ]}
                        />
                      </div>
                    )}
                  </div>
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

      {/* ────────────────────────────────────────────────────────────────────
           Preview-step modal — plan-mode-style confirmation for Request More
           Info. The AI proposes the question; the coordinator edits / confirms
           before it reaches the student.
          ──────────────────────────────────────────────────────────────────── */}
      {stepPreviewOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6"
          onClick={() => (stepPreviewBusy || busy ? null : setStepPreviewOpen(false))}
        >
          <div
            className="ug-card w-full max-w-[760px] max-h-[88vh] overflow-hidden flex flex-col shadow-ug-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-line-2 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">
                  Preview · Info request
                </div>
                <div className="text-[18px] font-semibold mt-0.5">
                  Confirm what the AI will ask the student
                </div>
                {stepPreview && (
                  <div className="text-[12px] text-ink-4 mt-1.5 mono">
                    step type: {stepPreview.type}
                    {stepPreview.citations.length > 0 && (
                      <span className="ml-2 text-ai-ink">
                        · {stepPreview.citations.length} citation
                        {stepPreview.citations.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                className="ug-btn ghost"
                onClick={() => setStepPreviewOpen(false)}
                disabled={stepPreviewBusy || busy !== null}
              >
                Cancel
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {stepPreviewBusy ? (
                <AiProgressBar
                  expectedMs={20_000}
                  stages={[
                    { at: 0, label: "Reading the SOP and your comment…" },
                    { at: 8, label: "Planning the next question for the student…" },
                  ]}
                  caption="The AI is reading the procedure SOP plus the application history to draft a question grounded in your request."
                />
              ) : stepPreviewError ? (
                <div className="space-y-3">
                  <div className="px-4 py-3 rounded-[10px] bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
                    {stepPreviewError}
                  </div>
                  <div className="text-[12px] text-ink-4">
                    You can still send the request without preview — the AI will plan the question
                    inline when you confirm.
                  </div>
                  <button
                    className="ug-btn"
                    onClick={requestInfoFallback}
                    disabled={busy !== null}
                  >
                    {busy === "request_info" ? "Sending…" : "Send without preview"}
                  </button>
                </div>
              ) : stepPreview ? (
                <>
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">
                      Question shown to the student — edit before confirming
                    </span>
                    <textarea
                      className="ug-textarea mt-1.5 min-h-[120px] text-[13.5px] leading-relaxed"
                      value={stepPreview.prompt_text}
                      onChange={(e) =>
                        setStepPreview({ ...stepPreview, prompt_text: e.target.value })
                      }
                      disabled={busy !== null}
                    />
                  </label>

                  {stepPreview.config && Object.keys(stepPreview.config).length > 0 && (
                    <div className="mt-4">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-1.5">
                        Step configuration (read-only)
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-card-2 border border-line text-[12px] text-ink-3 mono whitespace-pre-wrap">
                        {JSON.stringify(stepPreview.config, null, 2)}
                      </div>
                    </div>
                  )}

                  {stepPreview.reasoning && (
                    <div className="mt-4 px-4 py-3 rounded-[10px] bg-ai-tint border border-ai-line">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink mb-1 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" strokeWidth={2.25} />
                        Why the AI is asking this
                      </div>
                      <div className="text-[12.5px] text-ink-2 leading-snug">
                        {stepPreview.reasoning}
                      </div>
                    </div>
                  )}

                  {stepPreview.citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {stepPreview.citations.map((c, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-ai-tint border border-ai-line text-ai-ink"
                        >
                          §{c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Coassist — revise the proposed step's prompt_text */}
                  <div className="mt-5 pt-4 border-t border-line-2">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" strokeWidth={2.25} />
                      Revise with AI
                    </div>

                    {coassistTurns.step_prompt.length > 0 && (
                      <div className="mb-2.5 space-y-1.5">
                        {coassistTurns.step_prompt.map((t, i) => (
                          <div
                            key={i}
                            className={`text-[12px] px-3 py-1.5 rounded-lg ${
                              t.role === "coordinator"
                                ? "bg-card-2 text-ink-2 border border-line"
                                : "bg-ai-tint text-ink-2 border border-ai-line"
                            }`}
                          >
                            <span className="font-semibold mr-1.5">
                              {t.role === "coordinator" ? "You:" : "AI:"}
                            </span>
                            {t.text}
                          </div>
                        ))}
                      </div>
                    )}

                    {coassistError.step_prompt && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[12px] text-crimson">
                        {coassistError.step_prompt}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="ug-input flex-1 text-[13px]"
                        placeholder="e.g. Be more specific about which document · Use simpler language"
                        value={coassistInstruction.step_prompt}
                        onChange={(e) =>
                          setCoassistInstruction({
                            ...coassistInstruction,
                            step_prompt: e.target.value,
                          })
                        }
                        disabled={coassistBusy === "step_prompt" || busy !== null}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void runCoassist("step_prompt", stepPreview.prompt_text, (text) => {
                              setStepPreview({ ...stepPreview, prompt_text: text });
                            });
                          }
                        }}
                      />
                      <button
                        className="ug-btn gap-1.5"
                        style={{
                          background: "var(--ai-tint)",
                          color: "var(--ai-ink)",
                          borderColor: "var(--ai-line)",
                        }}
                        onClick={() =>
                          runCoassist("step_prompt", stepPreview.prompt_text, (text) => {
                            setStepPreview({ ...stepPreview, prompt_text: text });
                          })
                        }
                        disabled={
                          coassistBusy === "step_prompt" ||
                          busy !== null ||
                          !coassistInstruction.step_prompt.trim()
                        }
                      >
                        {coassistBusy === "step_prompt" ? "Revising…" : "Revise"}
                      </button>
                    </div>

                    {coassistBusy === "step_prompt" && (
                      <div className="mt-2">
                        <AiProgressBar
                          expectedMs={20_000}
                          compact
                          label="Rewording the question…"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {!stepPreviewBusy && !stepPreviewError && stepPreview && (
              <div className="px-6 py-4 border-t border-line-2 flex items-center justify-between gap-3">
                <div className="text-[12px] text-ink-4">
                  This becomes a new step in the student's flow. They can answer right away.
                </div>
                <button
                  className="ug-btn gap-2"
                  style={{
                    background: "var(--amber-soft)",
                    color: "var(--amber)",
                    borderColor: "#E8DBB5",
                  }}
                  onClick={confirmStepRequest}
                  disabled={busy !== null || !stepPreview.prompt_text.trim()}
                >
                  {busy === "request_info" ? (
                    "Sending…"
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4" strokeWidth={1.85} />
                      Confirm & send to student
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
           Briefing-coassist drawer — Q&A about the briefing. The briefing
           record itself is NOT mutated here; this is a chat surface so the
           coordinator can ask "why did you flag X" or "rephrase this more
           politely". The conversation lives only in this modal session.
          ──────────────────────────────────────────────────────────────────── */}
      {briefingCoassistOpen && data?.briefing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6"
          onClick={() =>
            coassistBusy === "briefing_reasoning" ? null : setBriefingCoassistOpen(false)
          }
        >
          <div
            className="ug-card w-full max-w-[640px] max-h-[88vh] overflow-hidden flex flex-col shadow-ug-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-line-2 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" strokeWidth={2.25} />
                  Ask the AI about this briefing
                </div>
                <div className="text-[18px] font-semibold mt-0.5">
                  Q&amp;A — the audit record stays as-is
                </div>
                <div className="text-[12px] text-ink-4 mt-1.5">
                  Anything you ask here doesn't change the briefing row.
                  It's a chat surface for understanding.
                </div>
              </div>
              <button
                className="ug-btn ghost"
                onClick={() => setBriefingCoassistOpen(false)}
                disabled={coassistBusy === "briefing_reasoning"}
              >
                Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="px-3 py-2 mb-4 rounded-lg bg-card-2 border border-line text-[12.5px] text-ink-3 leading-relaxed">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-1">
                  Original briefing reasoning
                </div>
                {data.briefing.reasoning}
              </div>

              {coassistTurns.briefing_reasoning.length === 0 && !coassistBusy && (
                <div className="text-[12.5px] text-ink-4 italic">
                  Ask anything — e.g. "Why did you flag the income tier?",
                  "Rephrase the reasoning more politely",
                  "What SOP rule applies here?"
                </div>
              )}

              {coassistTurns.briefing_reasoning.map((t, i) => (
                <div
                  key={i}
                  className={`mb-2 px-3 py-2 rounded-lg text-[13px] leading-relaxed ${
                    t.role === "coordinator"
                      ? "bg-card-2 text-ink-2 border border-line"
                      : "bg-ai-tint text-ink-2 border border-ai-line"
                  }`}
                >
                  <div className="text-[10.5px] uppercase tracking-wider font-semibold mb-0.5 opacity-70">
                    {t.role === "coordinator" ? "You" : "AI"}
                  </div>
                  {t.text}
                </div>
              ))}

              {coassistExplanation.briefing_reasoning &&
                coassistTurns.briefing_reasoning.length === 0 && (
                  <div className="mb-2 px-3 py-2 rounded-lg bg-ai-tint border border-ai-line text-[13px] text-ink-2 leading-relaxed">
                    {coassistExplanation.briefing_reasoning}
                  </div>
                )}

              {coassistError.briefing_reasoning && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[12.5px] text-crimson">
                  {coassistError.briefing_reasoning}
                </div>
              )}

              {coassistBusy === "briefing_reasoning" && (
                <div className="mb-2">
                  <AiProgressBar
                    expectedMs={20_000}
                    compact
                    label="Thinking…"
                  />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="ug-input flex-1 text-[13px]"
                  placeholder="Ask about this briefing…"
                  value={coassistInstruction.briefing_reasoning}
                  onChange={(e) =>
                    setCoassistInstruction({
                      ...coassistInstruction,
                      briefing_reasoning: e.target.value,
                    })
                  }
                  disabled={coassistBusy === "briefing_reasoning"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && data?.briefing) {
                      e.preventDefault();
                      void runCoassist(
                        "briefing_reasoning",
                        data.briefing.reasoning,
                        null
                      );
                    }
                  }}
                />
                <button
                  className="ug-btn gap-1.5"
                  style={{
                    background: "var(--ai-tint)",
                    color: "var(--ai-ink)",
                    borderColor: "var(--ai-line)",
                  }}
                  onClick={() =>
                    data?.briefing &&
                    runCoassist("briefing_reasoning", data.briefing.reasoning, null)
                  }
                  disabled={
                    coassistBusy === "briefing_reasoning" ||
                    !coassistInstruction.briefing_reasoning.trim()
                  }
                >
                  {coassistBusy === "briefing_reasoning" ? "Asking…" : "Ask"}
                </button>
              </div>
            </div>
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

  // Compound form response — { fieldKey: string | { filename, storage_path } }
  if (s.type === "form") {
    const entries = Object.entries(r);
    if (entries.length > 0) {
      return (
        <div className="flex flex-col gap-1.5">
          {entries.map(([k, v]) => {
            if (v && typeof v === "object" && !Array.isArray(v) && "filename" in v) {
              const obj = v as { filename: string; storage_path?: string; size?: number };
              return (
                <div key={k} className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{k}</span>
                  {obj.storage_path
                    ? <FileViewLink filename={obj.filename} path={obj.storage_path} size={obj.size} />
                    : <span className="text-ink-3">{obj.filename}</span>}
                </div>
              );
            }
            return (
              <div key={k} className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{k}</span>
                <span className="text-ink-2 whitespace-pre-wrap">{String(v)}</span>
              </div>
            );
          })}
        </div>
      );
    }
  }

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
