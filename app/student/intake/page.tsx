"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function IntakePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [clarify, setClarify] = useState<{ questions: string[]; reasoning: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setClarify(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Something went wrong");
        return;
      }

      if (json.data.kind === "clarify") {
        setClarify({
          questions: json.data.clarifying_questions,
          reasoning: json.data.reasoning,
        });
        return;
      }

      // ready — kick off planning, then navigate.
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: json.data.workflow_id }),
      });
      const planJson = await planRes.json();
      if (!planJson.ok) {
        setError(planJson.error ?? "Planning failed");
        return;
      }

      router.push(`/student/workflow/${json.data.workflow_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Tell me what you're trying to do.
      </h1>
      <p className="mt-2 text-slate-600">
        Plain English is fine — I'll work out which procedure applies and ask for any missing context.
      </p>

      <div className="mt-8 card p-4">
        <textarea
          className="w-full resize-none rounded-md border-0 bg-transparent text-base outline-none placeholder:text-slate-400"
          placeholder="e.g. i need to do industrial training next sem, my cgpa is 3.1, uncle's company"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          disabled={loading}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">{text.length} / 4000</span>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={loading || text.trim().length === 0}
          >
            {loading ? "Thinking…" : "Continue"}
          </button>
        </div>
      </div>

      {clarify && (
        <div className="mt-6 card border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">A bit more context, please</h3>
          <p className="mt-1 text-sm text-amber-800">{clarify.reasoning}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {clarify.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-6 card border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-10 text-xs text-slate-400">
        Powered by Z.AI GLM. Every decision is logged with reasoning trace for full audit.
      </div>
    </div>
  );
}
