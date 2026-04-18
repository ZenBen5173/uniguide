"use client";

import { useState } from "react";

interface Briefing {
  id: string;
  workflow_id: string;
  extracted_facts: Record<string, unknown>;
  flags: Array<{ severity: string; message: string }>;
  recommendation: "approve" | "reject" | "request_info";
  reasoning: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  block: "border-red-300 bg-red-50 text-red-800",
  warn: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const RECOMMENDATION_STYLES: Record<string, string> = {
  approve: "border-emerald-400 bg-emerald-50 text-emerald-900",
  reject: "border-red-400 bg-red-50 text-red-900",
  request_info: "border-amber-400 bg-amber-50 text-amber-900",
};

export default function BriefingCard({
  briefing,
  onResolved,
}: {
  briefing: Briefing;
  onResolved: () => void;
}) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const decide = async (decision: "approve" | "reject" | "request_info") => {
    if (decision === "reject" && !comment) {
      const ok = window.confirm("Reject without a comment? You can add a reason for the student.");
      if (!ok) return;
    }
    setResolving(decision);
    try {
      const res = await fetch("/api/admin/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing_id: briefing.id, decision, comment: comment || undefined }),
      });
      if ((await res.json()).ok) onResolved();
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">Workflow {briefing.workflow_id.slice(0, 8)}</h3>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${
                RECOMMENDATION_STYLES[briefing.recommendation]
              }`}
            >
              GLM recommends: {briefing.recommendation.replace("_", " ")}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-700">{briefing.reasoning}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(briefing.extracted_facts).map(([k, v]) => (
          <div key={k} className="rounded border border-slate-100 bg-slate-50 p-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </dd>
          </div>
        ))}
      </dl>

      {briefing.flags.length > 0 && (
        <ul className="mt-4 space-y-2">
          {briefing.flags.map((f, i) => (
            <li
              key={i}
              className={`rounded border px-3 py-2 text-sm ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info}`}
            >
              <span className="font-medium uppercase">{f.severity}</span> · {f.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <textarea
          className="w-full resize-none rounded border border-slate-200 p-2 text-sm"
          rows={2}
          placeholder="Optional comment to student…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary text-sm"
            onClick={() => decide("approve")}
            disabled={!!resolving}
          >
            {resolving === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            className="btn text-sm border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
            onClick={() => decide("request_info")}
            disabled={!!resolving}
          >
            Request more info
          </button>
          <button
            className="btn text-sm border border-red-400 bg-red-50 text-red-900 hover:bg-red-100"
            onClick={() => decide("reject")}
            disabled={!!resolving}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
