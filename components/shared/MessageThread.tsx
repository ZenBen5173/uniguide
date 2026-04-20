"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

interface Message {
  id: string;
  body: string;
  author_id: string;
  author_role: "student" | "coordinator";
  author_name: string;
  created_at: string;
  is_mine: boolean;
}

export default function MessageThread({
  applicationId,
  variant = "rail",
}: {
  applicationId: string;
  variant?: "rail" | "panel";
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const r = await fetch(`/api/applications/${applicationId}/messages`);
      const j = await r.json();
      if (j.ok) setMessages(j.data.messages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [applicationId]);

  // Realtime: subscribe to new messages on this application.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`messages:${applicationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "application_messages", filter: `application_id=eq.${applicationId}` },
        () => { void refresh(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [applicationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    if (draft.trim().length === 0) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const r = await fetch(`/api/applications/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = await r.json();
      if (!j.ok) {
        setDraft(text);
        alert(`Send failed: ${j.error}`);
      } else {
        await refresh();
      }
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="ug-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-line-2 flex items-center gap-2">
        <MessageCircle className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.85} />
        <div className="text-[13px] font-semibold text-ink">Messages</div>
        <span className="text-[11px] text-ink-4 ml-auto">{messages.length}</span>
      </div>

      <div ref={scrollRef} className={`overflow-y-auto px-3 py-3 ${variant === "rail" ? "max-h-[280px]" : "max-h-[440px]"} bg-paper-2/40`}>
        {loading && (
          <div className="text-center text-[12px] text-ink-4 py-4">Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-[12px] text-ink-4 py-4 leading-relaxed">
            No messages yet. Use this for quick questions outside the structured steps.
          </div>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] ${m.is_mine ? "self-end" : "self-start"}`}
            >
              {!m.is_mine && (
                <div className="text-[10.5px] text-ink-4 mb-0.5 px-1 mono">{m.author_name}</div>
              )}
              <div
                className={`px-3 py-2 rounded-[10px] text-[12.5px] leading-snug whitespace-pre-wrap ${
                  m.is_mine
                    ? "bg-ink text-white rounded-tr-sm"
                    : m.author_role === "coordinator"
                      ? "bg-amber-soft text-ink-2 border border-[#E8DBB5] rounded-tl-sm"
                      : "bg-card text-ink-2 border border-line rounded-tl-sm"
                }`}
              >
                {m.body}
              </div>
              <div className={`text-[10px] text-ink-4 mt-0.5 px-1 mono ${m.is_mine ? "text-right" : "text-left"}`}>
                {timeStamp(m.created_at)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line-2 p-2.5 bg-card">
        <textarea
          className="ug-textarea text-[12.5px] min-h-[64px]"
          placeholder="Write a message… (Ctrl/Cmd+Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          disabled={sending}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10.5px] text-ink-4">{draft.length} / 4000</span>
          <button
            onClick={send}
            disabled={sending || draft.trim().length === 0}
            className="ug-btn primary sm inline-flex items-center gap-1.5"
          >
            <Send className="h-3 w-3" strokeWidth={2} />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeStamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
