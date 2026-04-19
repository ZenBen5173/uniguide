"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Template {
  id: string;
  template_type: "acceptance" | "rejection" | "request_info" | "custom";
  name: string;
  template_text: string;
  detected_placeholders: string[];
  updated_at: string;
}

const DEFAULT_TEMPLATE: Record<Template["template_type"], string> = {
  acceptance: `# Letter of Acceptance

Dear {{full_name}},

We are pleased to inform you that your application for {{procedure_name}} has been approved.

{{coordinator_comment}}

Please confirm your acceptance within 14 days.

Yours sincerely,
{{office_name}}
Universiti Malaya
`,
  rejection: `# Letter Regarding Your Application

Dear {{full_name}},

After careful review, we regret to inform you that your application for {{procedure_name}} was not successful this round.

{{coordinator_comment}}

You may appeal this decision within 14 days under Reg. 40.

Yours sincerely,
{{office_name}}
Universiti Malaya
`,
  request_info: `Dear {{full_name}},

Thank you for your application for {{procedure_name}}. Before we can proceed, we need additional information:

{{coordinator_comment}}

Please respond within 7 working days through your UniGuide portal.

Yours sincerely,
{{office_name}}
`,
  custom: ``,
};

const TYPE_LABEL: Record<Template["template_type"], string> = {
  acceptance: "Acceptance",
  rejection: "Rejection",
  request_info: "Request info",
  custom: "Custom",
};

export default function LetterTemplateEditor({ procedureId }: { procedureId: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState<Template["template_type"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch(`/api/admin/procedures/${procedureId}/letter-templates`);
      const j = await r.json();
      if (j.ok) setTemplates(j.data.templates);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [procedureId]);

  const startCreate = (kind: Template["template_type"]) => {
    setEditing({
      id: "new",
      template_type: kind,
      name: `${TYPE_LABEL[kind]} letter`,
      template_text: DEFAULT_TEMPLATE[kind],
      detected_placeholders: [],
      updated_at: new Date().toISOString(),
    });
    setCreating(kind);
    setErr(null);
  };

  const startEdit = (t: Template) => {
    setEditing({ ...t });
    setCreating(null);
    setErr(null);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/procedures/${procedureId}/letter-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_type: editing.template_type,
          name: editing.name,
          template_text: editing.template_text,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error);
        return;
      }
      setEditing(null);
      setCreating(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeTemplate = async (t: Template) => {
    if (!confirm(`Delete the "${t.name}" template? Decisions made afterward will not have a letter.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/procedures/${procedureId}/letter-templates/${t.id}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (j.ok) await refresh();
    } finally {
      setBusy(false);
    }
  };

  const missingTypes = (["acceptance", "rejection", "request_info"] as const).filter(
    (k) => !templates.some((t) => t.template_type === k)
  );

  return (
    <div>
      <div className="px-4 py-3.5 border-b border-line-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Letter templates</div>
        <span className="text-[12px] text-ink-4 mono">{templates.length}</span>
      </div>

      {loading && (
        <div className="px-4 py-6 text-center text-ink-4 text-[13px]">Loading…</div>
      )}

      {!loading && templates.length === 0 && (
        <div className="px-4 py-6 text-center text-ink-4 text-[13px]">
          No letter templates yet. Add one below to enable acceptance / rejection letters.
        </div>
      )}

      {!loading && templates.map((t) => (
        <div key={t.id} className="px-4 py-3.5 border-b border-line-2 last:border-b-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`ug-pill ${t.template_type === "acceptance" ? "ok" : t.template_type === "rejection" ? "" : "warn"}`} style={t.template_type === "rejection" ? { background: "var(--crimson-soft)", color: "var(--crimson)", borderColor: "#E8C5CB" } : undefined}>
              {TYPE_LABEL[t.template_type]}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => startEdit(t)}
                className="p-1.5 rounded hover:bg-paper-2 text-ink-3 hover:text-ink"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => void removeTemplate(t)}
                disabled={busy}
                className="p-1.5 rounded hover:bg-crimson-soft text-ink-3 hover:text-crimson disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
          <div className="text-[13px] font-medium text-ink mb-2">{t.name}</div>
          <div className="flex flex-wrap gap-1.5">
            {t.detected_placeholders?.map((p) => (
              <span key={p} className="text-[10.5px] mono px-1.5 py-0.5 rounded bg-ai-tint text-ai-ink border border-ai-line">
                {p}
              </span>
            ))}
          </div>
        </div>
      ))}

      {!loading && missingTypes.length > 0 && (
        <div className="px-4 py-3 border-t border-line-2 bg-paper-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4 mb-2">Add a template</div>
          <div className="flex flex-wrap gap-1.5">
            {missingTypes.map((k) => (
              <button
                key={k}
                onClick={() => startCreate(k)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-line text-[12px] font-medium text-ink-3 hover:border-ink hover:text-ink hover:bg-card"
              >
                <Plus className="h-3 w-3" strokeWidth={2} />
                {TYPE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => busy ? null : setEditing(null)}>
          <div className="ug-card w-full max-w-[760px] max-h-[88vh] overflow-hidden flex flex-col shadow-ug-lift" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-line-2 flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">
                  {creating ? "New" : "Edit"} · {TYPE_LABEL[editing.template_type]} template
                </div>
                <div className="text-[18px] font-semibold mt-0.5">
                  Letter template
                </div>
                <div className="text-[12px] text-ink-4 mt-1">
                  Use <span className="mono">{"{{placeholder}}"}</span> for fields the AI fills at decision time. Common: full_name, procedure_name, coordinator_comment, office_name, faculty.
                </div>
              </div>
              <button className="ug-btn ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <div>
                <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">Template name</label>
                <input
                  className="ug-input mt-1.5"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Standard B40 acceptance letter"
                />
              </div>
              <div>
                <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">Template text</label>
                <textarea
                  className="ug-textarea mt-1.5 min-h-[340px] mono text-[12.5px]"
                  value={editing.template_text}
                  onChange={(e) => setEditing({ ...editing, template_text: e.target.value })}
                />
              </div>
              {err && (
                <div className="px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[13px] text-crimson">
                  {err}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line-2 flex items-center justify-between">
              <div className="text-[12px] text-ink-4">
                {editing.template_text.length} chars · {(editing.template_text.match(/\{\{[^}]+\}\}/g) ?? []).length} placeholders
              </div>
              <button
                className="ug-btn primary"
                onClick={save}
                disabled={busy || editing.name.trim().length === 0 || editing.template_text.trim().length < 20}
              >
                {busy ? "Saving…" : creating ? "Create template" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
