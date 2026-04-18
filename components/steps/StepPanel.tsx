"use client";

import { useState } from "react";

interface Stage {
  id: string;
  label: string;
  status: string;
  assignee_role: string | null;
}

interface Step {
  id: string;
  ordinal: number;
  type: string;
  label: string;
  config: Record<string, unknown>;
  required: boolean;
  status: string;
}

interface StepResponse {
  step_id: string;
  response_data: Record<string, unknown>;
}

export default function StepPanel({
  stage,
  steps,
  responses,
  onSubmitted,
}: {
  stage: Stage;
  steps: Step[];
  responses: StepResponse[];
  onSubmitted: () => void;
}) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});

  const responseFor = (stepId: string) =>
    responses.find((r) => r.step_id === stepId)?.response_data;

  const submit = async (stepId: string, payload: Record<string, unknown>) => {
    setSubmitting(stepId);
    try {
      const res = await fetch(`/api/step/${stepId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response_data: payload }),
      });
      const json = await res.json();
      if (json.ok) onSubmitted();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-400">Active stage</p>
        <h2 className="text-lg font-semibold">{stage.label}</h2>
        {stage.assignee_role && (
          <p className="mt-1 text-xs text-slate-500">For: {stage.assignee_role.replace(/_/g, " ")}</p>
        )}
      </div>

      {steps.length === 0 && (
        <p className="text-sm text-slate-500">
          No interactive steps for this stage — the system is processing.
        </p>
      )}

      <ol className="space-y-4">
        {steps.map((step) => {
          const existing = responseFor(step.id);
          const done = step.status === "completed";

          return (
            <li key={step.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{step.type}</p>
                </div>
                {done && <span className="text-xs text-emerald-600">✓ done</span>}
              </div>

              {!done && (
                <div className="mt-3 space-y-2">
                  {step.type === "form" && (
                    <input
                      type="text"
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Type your response…"
                      onChange={(e) => setLocalValues((v) => ({ ...v, [step.id]: e.target.value }))}
                    />
                  )}
                  {step.type === "approval" && (
                    <p className="text-sm text-slate-600">
                      Confirm to proceed.
                    </p>
                  )}
                  {step.type === "upload" && (
                    <input
                      type="file"
                      className="text-sm"
                      onChange={(e) =>
                        setLocalValues((v) => ({
                          ...v,
                          [step.id]: e.target.files?.[0]?.name ?? null,
                        }))
                      }
                    />
                  )}
                  <button
                    className="btn-primary mt-2 text-sm"
                    disabled={submitting === step.id}
                    onClick={() =>
                      submit(step.id, { value: localValues[step.id] ?? true })
                    }
                  >
                    {submitting === step.id ? "Saving…" : "Submit step"}
                  </button>
                </div>
              )}

              {done && existing && (
                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-600">
                  {JSON.stringify(existing, null, 2)}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
