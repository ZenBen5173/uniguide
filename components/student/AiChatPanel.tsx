"use client";

/**
 * Always-on AI chat side panel for the student's smart-application screen.
 *
 * The student types questions about their procedure, current step, or
 * specific situation. The AI is grounded in the SOP, the student's profile,
 * the step they're on, and the history of completed steps. When the AI
 * judges that the question requires human discretion, it pre-drafts an
 * escalation summary and the panel offers a one-click "Ask a coordinator"
 * pill that opens the chat thread to the coordinator's queue.
 *
 * Hybrid escalation: clicking escalate does NOT submit the application —
 * it just flags the application so the coordinator's Triage tab surfaces
 * it. The student keeps filling steps and can submit normally.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import AiProgressBar from "@/components/shared/AiProgressBar";

interface ChatMessage {
  id: string;
  author_role: "student" | "ai" | "coordinator";
  body: string;
  kind: "chat" | "escalation_summary";
  created_at: string;
}

interface AiChatPanelProps {
  applicationId: string;
  /** Set when the application has an open escalation (rendered by parent). */
  escalationPending: boolean;
}

export default function AiChatPanel({ applicationId, escalationPending }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEscalation, setPendingEscalation] = useState<string | null>(null);
  const [escalateBusy, setEscalateBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load + realtime subscription so coordinator replies show up live.
  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserSupabase();

    const load = async () => {
      const { data, error: loadErr } = await supabase
        .from("application_messages")
        .select("id, author_role, body, kind, created_at")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled && data && !loadErr) {
        setMessages(
          (data as ChatMessage[]).filter(
            (m) => m.kind === "chat" || m.kind === "escalation_summary"
          )
        );
      }
    };
    void load();

    const channel = supabase
      .channel(`application_messages:${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "application_messages",
          filter: `application_id=eq.${applicationId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          if (m.kind !== "chat" && m.kind !== "escalation_summary") return;
          setMessages((prev) => {
            if (prev.find((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [applicationId]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not send message");
        return;
      }
      // Realtime subscription will deliver the new rows; nothing else to do.
      if (json.data.suggest_escalate && json.data.escalation_summary) {
        setPendingEscalation(json.data.escalation_summary);
      } else {
        setPendingEscalation(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    if (!pendingEscalation || escalateBusy) return;
    setEscalateBusy(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: pendingEscalation }),
      });
      const json = await res.json();
      if (!json.ok) {
        alert(`Could not escalate: ${json.error}`);
        return;
      }
      setPendingEscalation(null);
    } finally {
      setEscalateBusy(false);
    }
  };

  return (
    <div className="ug-rail-card flex flex-col" style={{ minHeight: 360 }}>
      <div className="ug-rail-head flex items-center justify-between">
        <div className="ug-rail-title flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-ai-ink" strokeWidth={2.25} />
          Ask UniGuide
        </div>
        {escalationPending && (
          <span className="text-[10.5px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-soft text-amber border border-[#E8DBB5]">
            Escalated
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
        style={{ maxHeight: 420 }}
      >
        {messages.length === 0 && !busy && (
          <div className="text-[12px] text-ink-4 italic px-1 py-2">
            Stuck? Confused? Ask anything about your application — the AI knows your SOP and what
            you've answered so far. Type "I need a coordinator" if a human should look.
          </div>
        )}

        {messages.map((m) => {
          if (m.kind === "escalation_summary") {
            return (
              <div
                key={m.id}
                className="px-3 py-2 rounded-lg bg-amber-soft border border-[#E8DBB5] text-[12px] text-amber"
              >
                <div className="text-[10.5px] uppercase tracking-wider font-bold mb-1">
                  Escalation summary — visible to coordinator
                </div>
                {m.body}
              </div>
            );
          }
          const role = m.author_role;
          return (
            <div
              key={m.id}
              className={`px-3 py-2 rounded-lg text-[12.5px] leading-relaxed ${
                role === "student"
                  ? "bg-card-2 text-ink-2 border border-line"
                  : role === "ai"
                  ? "bg-ai-tint text-ink-2 border border-ai-line"
                  : "bg-amber-soft text-ink-2 border border-[#E8DBB5]"
              }`}
            >
              <div className="text-[10.5px] uppercase tracking-wider font-bold mb-0.5 opacity-70">
                {role === "student" ? "You" : role === "ai" ? "UniGuide AI" : "Coordinator"}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          );
        })}

        {busy && (
          <div className="px-1 py-1">
            <AiProgressBar
              expectedMs={20_000}
              compact
              label="UniGuide AI is thinking…"
            />
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[11.5px] text-crimson">
            {error}
          </div>
        )}

        {pendingEscalation && !escalationPending && (
          <button
            className="w-full text-left px-3 py-2 rounded-lg bg-amber-soft border border-[#E8DBB5] text-[12px] text-amber font-semibold hover:opacity-90"
            onClick={escalate}
            disabled={escalateBusy}
          >
            {escalateBusy
              ? "Sending to coordinator…"
              : "→ Ask a coordinator (they'll see your situation and reply here)"}
          </button>
        )}
      </div>

      <div className="px-3 pt-2 pb-2 border-t border-line-2 flex gap-2">
        <input
          type="text"
          className="ug-input flex-1 text-[12.5px]"
          placeholder={
            escalationPending
              ? "Coordinator will reply here…"
              : "Ask about this procedure, current step, or your situation…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          className="ug-btn gap-1.5"
          style={{
            background: "var(--ai-tint)",
            color: "var(--ai-ink)",
            borderColor: "var(--ai-line)",
            paddingLeft: 12,
            paddingRight: 12,
          }}
          onClick={send}
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          {busy ? (
            "…"
          ) : (
            <Send className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
        </button>
      </div>
    </div>
  );
}
