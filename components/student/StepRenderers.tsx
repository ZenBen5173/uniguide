/**
 * Renderers for each AI-emitted step type. Each takes a step + a controlled
 * value object + an onChange callback, and renders the appropriate UI.
 *
 * The Smart Application page collects responses via these and submits them
 * back to /api/applications/[id]/respond.
 */
"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export interface StepShape {
  id: string;
  ordinal: number;
  type: string;
  prompt_text: string;
  config: Record<string, unknown>;
  emitted_by: "ai" | "coordinator";
}

interface RendererProps {
  step: StepShape;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  applicationId?: string;
}

/* ─── small helpers ─── */
function PromptCard({ children, footnote }: { children: ReactNode; footnote?: string }) {
  return (
    <div className="ug-ai-prompt">
      <span className="ug-ai-prompt-mark">
        <span className="spark" />
        UniGuide
      </span>
      <div className="ug-ai-prompt-text">
        {children}
        {footnote && <span className="ref">{footnote}</span>}
      </div>
    </div>
  );
}

/* ─── form ─── */
export function FormStep({ step, value, onChange, applicationId }: RendererProps) {
  const fields = (step.config.fields as Array<{
    key: string; label: string; field_type: string; required?: boolean; placeholder?: string; accepts?: string[];
  }>) ?? [];
  const hasFile = fields.some((f) => f.field_type === "file");
  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      <div className={`grid grid-cols-${hasFile ? 1 : 2} sm:grid-cols-2 gap-x-4 gap-y-4 mb-5`}>
        {fields.map((f) => {
          const wide = fields.length === 1 || f.field_type === "textarea" || f.field_type === "file";
          if (f.field_type === "file") {
            return (
              <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
                <label className="text-[13px] font-semibold text-ink-2 mb-1.5 block">
                  {f.label}
                  {f.required && <span className="text-crimson font-semibold ml-1">*</span>}
                </label>
                <FileFieldInput
                  fieldKey={f.key}
                  accepts={f.accepts ?? ["application/pdf", "image/*"]}
                  applicationId={applicationId}
                  stepId={step.id}
                  value={(value[f.key] as Record<string, unknown> | undefined) ?? null}
                  onChange={(v) => onChange({ ...value, [f.key]: v })}
                />
              </div>
            );
          }
          if (f.field_type === "textarea") {
            return (
              <div key={f.key} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
                <label className="text-[13px] font-semibold text-ink-2">
                  {f.label}
                  {f.required && <span className="text-crimson font-semibold ml-1">*</span>}
                </label>
                <textarea
                  className="ug-textarea min-h-[100px]"
                  placeholder={f.placeholder}
                  value={(value[f.key] as string) ?? ""}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                />
              </div>
            );
          }
          return (
            <div key={f.key} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
              <label className="text-[13px] font-semibold text-ink-2">
                {f.label}
                {f.required && <span className="text-crimson font-semibold ml-1">*</span>}
              </label>
              <input
                type={f.field_type === "number" ? "number" : f.field_type === "email" ? "email" : f.field_type === "date" ? "date" : "text"}
                className="ug-input"
                placeholder={f.placeholder}
                value={(value[f.key] as string) ?? ""}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

function FileFieldInput({
  fieldKey, accepts, applicationId, stepId, value, onChange,
}: {
  fieldKey: string;
  accepts: string[];
  applicationId?: string;
  stepId: string;
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filename = value?.filename as string | undefined;
  const storagePath = value?.storage_path as string | undefined;

  const handleFile = async (file: File) => {
    if (!applicationId) {
      setError("Internal: missing application context");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${applicationId}/${stepId}-${fieldKey}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("application-files")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      onChange({
        filename: file.name,
        storage_path: path,
        size: file.size,
        content_type: file.type,
        uploaded_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (storagePath) {
      try {
        const supabase = getBrowserSupabase();
        await supabase.storage.from("application-files").remove([storagePath]);
      } catch { /* best-effort */ }
    }
    onChange(null);
  };

  if (filename) {
    return (
      <div className="ug-file-card">
        <div className="ug-file-icon">
          {filename.toUpperCase().endsWith(".PDF") ? "PDF" : "DOC"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-ink truncate">{filename}</div>
          <div className="text-[11.5px] text-ink-4 mt-0.5">
            <span className="text-moss font-medium">Stored securely</span>
          </div>
        </div>
        <button className="ug-btn ghost sm" onClick={remove}>Replace</button>
      </div>
    );
  }
  return (
    <>
      <label className={`ug-dropzone cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
        <div className="ug-dropzone-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-ink">
            {uploading ? "Uploading…" : "Click or drop file"}
          </div>
          <div className="text-[12px] text-ink-3 leading-snug">{accepts.join(", ")}</div>
        </div>
        <input
          type="file"
          accept={accepts.join(",")}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
      {error && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[12px] text-crimson">
          {error}
        </div>
      )}
    </>
  );
}

/* ─── file_upload ─── */
export function FileUploadStep({ step, value, onChange, applicationId }: RendererProps) {
  const accepts = (step.config.accepts as string[]) ?? ["application/pdf"];
  const fileName = (value.filename as string) ?? null;
  const storagePath = (value.storage_path as string) ?? null;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!applicationId) {
      setError("Internal: missing application context");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${applicationId}/${step.id}-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("application-files")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      onChange({
        filename: file.name,
        storage_path: path,
        size: file.size,
        content_type: file.type,
        uploaded_at: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async () => {
    if (storagePath) {
      try {
        const supabase = getBrowserSupabase();
        await supabase.storage.from("application-files").remove([storagePath]);
      } catch {
        // best-effort; orphan is harmless
      }
    }
    onChange({});
  };

  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>

      {fileName ? (
        <div className="ug-file-card">
          <div className="ug-file-icon">
            {fileName.toUpperCase().endsWith(".PDF") ? "PDF" : "DOC"}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">{fileName}</div>
            <div className="text-[12.5px] text-ink-4 mt-0.5 flex items-center gap-2">
              <span className="mono">{formatSize(value.size as number)}</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-5" />
              <span className="text-moss font-medium">Stored securely</span>
            </div>
          </div>
          <button
            className="ug-btn ghost sm danger-ghost"
            onClick={removeFile}
          >
            Replace
          </button>
        </div>
      ) : (
        <label className={`ug-dropzone cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="ug-dropzone-icon">
            {uploading ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-ink mb-1">
              {uploading ? "Uploading…" : "Drop file here or click to browse"}
            </div>
            <div className="text-[13px] text-ink-3 leading-snug">
              {accepts.join(", ")} up to 10 MB. Scanned copies are fine.
            </div>
          </div>
          <input
            type="file"
            accept={accepts.join(",")}
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
      )}
      {error && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-crimson-soft border border-[#E8C5CB] text-[12.5px] text-crimson">
          Upload failed: {error}
        </div>
      )}
    </>
  );
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ─── text ─── */
export function TextStep({ step, value, onChange }: RendererProps) {
  const multiline = (step.config.multiline as boolean) ?? true;
  const max = (step.config.max_length as number) ?? 6000;
  const suggested = (step.config.ai_suggested_prompts as string[]) ?? [];
  const text = (value.text as string) ?? "";

  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-semibold text-ink-2 mb-1">
          Your response
          <span className="text-xs text-ink-4 font-normal ml-1">auto-saves as you type</span>
        </label>
        {multiline ? (
          <textarea
            className="ug-textarea"
            placeholder="Begin here…"
            maxLength={max}
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        ) : (
          <input
            type="text"
            className="ug-input"
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        )}
        <div className="flex items-center justify-between mt-1.5 text-xs text-ink-4">
          <span>The AI drafts nothing on your behalf — suggestions only.</span>
          <span className="mono text-ink-3">{text.length} / {max}</span>
        </div>
      </div>

      {suggested.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2.5 text-xs text-ink-4 font-medium">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-ai-ink">
              <path d="M12 2l2.35 5.6L20 8l-4 4 1.1 5.9L12 15.5 6.9 17.9 8 12 4 8l5.65-.4z" />
            </svg>
            Try one of these to go further
            <span className="flex-1 h-px bg-line-2" />
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.map((s, i) => (
              <button
                key={i}
                type="button"
                className="ug-chip"
                onClick={() => onChange({ text: text + (text ? "\n\n" : "") + s })}
              >
                {s} <span className="plus">+</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ─── select ─── */
export function SelectStep({ step, value, onChange }: RendererProps) {
  const options = (step.config.options as Array<{ value: string; label: string; description?: string }>) ?? [];
  const selected = (value.value as string) ?? "";

  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ value: opt.value })}
            className={`text-left p-3.5 rounded-[10px] border transition ${
              selected === opt.value
                ? "border-ink bg-[#F1F2F6]"
                : "border-line bg-white hover:border-ink-5"
            }`}
          >
            <div className="text-sm font-semibold text-ink">{opt.label}</div>
            {opt.description && <div className="text-xs text-ink-4 mt-1 leading-relaxed">{opt.description}</div>}
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── multiselect ─── */
export function MultiselectStep({ step, value, onChange }: RendererProps) {
  const options = (step.config.options as Array<{ value: string; label: string; description?: string }>) ?? [];
  const selected = (value.values as string[]) ?? [];
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange({ values: selected.filter((x) => x !== v) });
    else onChange({ values: [...selected, v] });
  };

  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`text-left p-3.5 rounded-[10px] border transition flex items-start gap-3 ${
              selected.includes(opt.value)
                ? "border-ink bg-[#F1F2F6]"
                : "border-line bg-white hover:border-ink-5"
            }`}
          >
            <div className={`mt-0.5 grid h-5 w-5 place-items-center rounded border-[1.5px] ${
              selected.includes(opt.value) ? "border-ink bg-ink" : "border-ink-5 bg-white"
            }`}>
              {selected.includes(opt.value) && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink">{opt.label}</div>
              {opt.description && <div className="text-xs text-ink-4 mt-1 leading-relaxed">{opt.description}</div>}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── info ─── */
export function InfoStep({ step, value, onChange }: RendererProps) {
  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      {step.config.body_markdown ? (
        <div className="text-[14.5px] leading-relaxed text-ink-2 mb-2 whitespace-pre-wrap">
          {step.config.body_markdown as string}
        </div>
      ) : null}
      <button
        type="button"
        className={`ug-btn gap-2 ${value.acknowledged ? "moss" : "primary"}`}
        onClick={() => onChange({ acknowledged: true })}
      >
        {value.acknowledged ? (<><Check className="h-4 w-4" strokeWidth={2.25} />Acknowledged</>) : "Got it"}
      </button>
    </>
  );
}

/* ─── final_submit ─── */
export function FinalSubmitStep({ step, value, onChange }: RendererProps) {
  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      <div className="rounded-[12px] border border-ink-5 bg-paper-2 p-5 mb-5">
        <p className="text-[14px] text-ink-2 leading-relaxed">
          {(step.config.summary_intro as string) ?? "Please review your application before submitting."}
        </p>
        <p className="text-[13px] text-ink-4 mt-2">
          Your full application will be sent to the coordinator. Once submitted, you can still
          message them — but you cannot edit responses directly.
        </p>
      </div>
      <button
        type="button"
        className={`ug-btn primary w-full justify-center ${value.confirmed ? "moss" : ""}`}
        onClick={() => onChange({ confirmed: true })}
      >
        {value.confirmed ? "Confirmed — click Submit Step below" : "I've reviewed everything · ready to submit"}
      </button>
    </>
  );
}

/* ─── coordinator_message ─── */
export function CoordinatorMessageStep({ step, value, onChange }: RendererProps) {
  const text = (value.student_response as string) ?? "";
  return (
    <>
      <div className="ug-ai-prompt" style={{ background: "var(--crimson-soft)", borderColor: "#E8C5CB" }}>
        <span className="ug-ai-prompt-mark" style={{ color: "var(--crimson)", borderColor: "#E8C5CB" }}>
          From Coordinator
        </span>
        <div className="ug-ai-prompt-text">{step.prompt_text}</div>
      </div>
      <textarea
        className="ug-textarea"
        placeholder="Type your response to the coordinator…"
        value={text}
        onChange={(e) => onChange({ student_response: e.target.value })}
      />
    </>
  );
}

/* ─── dispatcher ─── */
export function StepBody({ step, value, onChange, applicationId }: RendererProps) {
  switch (step.type) {
    case "form": return <FormStep step={step} value={value} onChange={onChange} />;
    case "file_upload": return <FileUploadStep step={step} value={value} onChange={onChange} applicationId={applicationId} />;
    case "text": return <TextStep step={step} value={value} onChange={onChange} />;
    case "select": return <SelectStep step={step} value={value} onChange={onChange} />;
    case "multiselect": return <MultiselectStep step={step} value={value} onChange={onChange} />;
    case "info": return <InfoStep step={step} value={value} onChange={onChange} />;
    case "final_submit": return <FinalSubmitStep step={step} value={value} onChange={onChange} />;
    case "coordinator_message": return <CoordinatorMessageStep step={step} value={value} onChange={onChange} />;
    default: return <PromptCard>{step.prompt_text}</PromptCard>;
  }
}
