"use client";

import { useEffect, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";

interface Note {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
  is_mine: boolean;
}

export default function InternalNotes({ applicationId }: { applicationId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetch(`/api/coordinator/applications/${applicationId}/notes`);
      const j = await r.json();
      if (j.ok) setNotes(j.data.notes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [applicationId]);

  const submit = async () => {
    if (draft.trim().length === 0) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/coordinator/applications/${applicationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setDraft("");
        setComposing(false);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: Note) => {
    if (!confirm("Delete this note?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/coordinator/applications/${applicationId}/notes/${note.id}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (j.ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ug-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-line-2 flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.85} />
          Internal notes
          <span className="text-[11px] font-normal text-ink-4">(staff only — never seen by student)</span>
        </div>
        {!composing && (
          <button
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-3 hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add note
          </button>
        )}
      </div>

      {composing && (
        <div className="px-5 py-3.5 border-b border-line-2 bg-paper-2">
          <textarea
            className="ug-textarea text-[13px] min-h-[88px]"
            placeholder="e.g. Called student — confirmed B40 income includes spouse's earnings."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              className="ug-btn ghost sm"
              onClick={() => { setComposing(false); setDraft(""); }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="ug-btn primary sm"
              onClick={submit}
              disabled={busy || draft.trim().length === 0}
            >
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-line-2">
        {loading ? (
          <div className="px-5 py-6 text-center text-ink-4 text-[13px]">Loading…</div>
        ) : notes.length === 0 && !composing ? (
          <div className="px-5 py-6 text-center text-ink-4 text-[13px]">
            No internal notes yet. Use these for context that shouldn't appear in the student-facing letter.
          </div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[12px] text-ink-4 mb-1.5">
                    <span className="font-semibold text-ink-2">{n.author_name}</span>
                    <span className="opacity-60"> · </span>
                    <span className="mono">{new Date(n.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-[13.5px] text-ink-2 whitespace-pre-wrap leading-relaxed">{n.body}</div>
                </div>
                {n.is_mine && (
                  <button
                    onClick={() => void remove(n)}
                    disabled={busy}
                    className="p-1.5 rounded text-ink-4 hover:text-crimson hover:bg-crimson-soft disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
