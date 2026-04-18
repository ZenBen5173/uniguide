/**
 * Renderers for each AI-emitted step type. Each takes a step + a controlled
 * value object + an onChange callback, and renders the appropriate UI.
 *
 * The Smart Application page collects responses via these and submits them
 * back to /api/applications/[id]/respond.
 */
"use client";

import type { ReactNode } from "react";

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
export function FormStep({ step, value, onChange }: RendererProps) {
  const fields = (step.config.fields as Array<{
    key: string; label: string; field_type: string; required?: boolean; placeholder?: string;
  }>) ?? [];
  return (
    <>
      <PromptCard>{step.prompt_text}</PromptCard>
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-5">
        {fields.map((f) => (
          <div key={f.key} className={`flex flex-col gap-1.5 ${fields.length === 1 ? "col-span-2" : ""}`}>
            <label className="text-[13px] font-semibold text-ink-2">
              {f.label}
              {f.required && <span className="text-crimson font-semibold ml-1">*</span>}
            </label>
            <input
              type={f.field_type === "number" ? "number" : f.field_type === "email" ? "email" : "text"}
              className="ug-input"
              placeholder={f.placeholder}
              value={(value[f.key] as string) ?? ""}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── file_upload ─── */
export function FileUploadStep({ step, value, onChange }: RendererProps) {
  const accepts = (step.config.accepts as string[]) ?? ["application/pdf"];
  const fileName = (value.filename as string) ?? null;

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
              <span className="mono">uploaded</span>
              <span className="w-[3px] h-[3px] rounded-full bg-ink-5" />
              <span className="text-moss font-medium">Parsed successfully</span>
            </div>
          </div>
          <button className="ug-btn ghost sm">Preview</button>
          <button
            className="ug-btn ghost sm danger-ghost"
            onClick={() => onChange({})}
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="ug-dropzone cursor-pointer">
          <div className="ug-dropzone-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-ink mb-1">Drop file here or click to browse</div>
            <div className="text-[13px] text-ink-3 leading-snug">
              {accepts.join(", ")} up to 10 MB. Scanned copies are fine.
            </div>
          </div>
          <input
            type="file"
            accept={accepts.join(",")}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChange({ filename: f.name, size: f.size });
            }}
          />
        </label>
      )}
    </>
  );
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
        className={`ug-btn ${value.acknowledged ? "moss" : "primary"}`}
        onClick={() => onChange({ acknowledged: true })}
      >
        {value.acknowledged ? "Acknowledged ✓" : "Got it"}
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
export function StepBody({ step, value, onChange }: RendererProps) {
  switch (step.type) {
    case "form": return <FormStep step={step} value={value} onChange={onChange} />;
    case "file_upload": return <FileUploadStep step={step} value={value} onChange={onChange} />;
    case "text": return <TextStep step={step} value={value} onChange={onChange} />;
    case "select": return <SelectStep step={step} value={value} onChange={onChange} />;
    case "multiselect": return <MultiselectStep step={step} value={value} onChange={onChange} />;
    case "info": return <InfoStep step={step} value={value} onChange={onChange} />;
    case "final_submit": return <FinalSubmitStep step={step} value={value} onChange={onChange} />;
    case "coordinator_message": return <CoordinatorMessageStep step={step} value={value} onChange={onChange} />;
    default: return <PromptCard>{step.prompt_text}</PromptCard>;
  }
}
