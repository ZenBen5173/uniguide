"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import WorkflowCanvas from "@/components/canvas/WorkflowCanvas";
import StepPanel from "@/components/steps/StepPanel";

interface WorkflowResponse {
  workflow: {
    id: string;
    procedure_id: string;
    status: string;
    intent_text: string | null;
  };
  stages: Array<{
    id: string;
    ordinal: number;
    label: string;
    node_type: "stage" | "decision" | "end";
    status: "locked" | "active" | "completed" | "skipped";
    assignee_role: string | null;
    metadata: Record<string, unknown>;
  }>;
  steps: Array<{
    id: string;
    stage_id: string;
    ordinal: number;
    type: string;
    label: string;
    config: Record<string, unknown>;
    required: boolean;
    status: string;
  }>;
  edges: Array<{
    id: string;
    source_stage_id: string;
    target_stage_id: string;
    condition_key: string | null;
    label: string | null;
  }>;
  responses: Array<{
    id: string;
    step_id: string;
    response_data: Record<string, unknown>;
  }>;
}

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<WorkflowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/workflow/${id}`);
      if (res.status === 401) {
        window.location.href = `/login?next=/student/workflow/${id}`;
        return;
      }
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 text-slate-500">Loading your workflow…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 text-red-700">
        {error ?? "Workflow not found"}
      </div>
    );
  }

  const activeStage = data.stages.find((s) => s.status === "active");
  const stageSteps = activeStage
    ? data.steps.filter((s) => s.stage_id === activeStage.id)
    : [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
              UniGuide
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium">{data.workflow.procedure_id.replace(/_/g, " ")}</span>
            <span className="ml-3 rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
              {data.workflow.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_400px]">
        <section className="card overflow-hidden" style={{ height: "70vh" }}>
          <WorkflowCanvas stages={data.stages} edges={data.edges} />
        </section>
        <aside className="card p-5">
          {activeStage && activeStage.assignee_role === "student" ? (
            <StepPanel
              stage={activeStage}
              steps={stageSteps}
              responses={data.responses}
              onSubmitted={refresh}
            />
          ) : activeStage && activeStage.assignee_role && activeStage.assignee_role !== "student" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Awaiting</p>
              <h2 className="mt-1 text-lg font-semibold">{activeStage.label}</h2>
              <p className="mt-3 text-sm text-slate-600">
                Your application is now with the <strong>{activeStage.assignee_role.replace(/_/g, " ")}</strong>.
                You'll be notified here when they respond. (For the demo, sign in as
                Demo Coordinator in another tab to see the briefing in their queue.)
              </p>
            </div>
          ) : data.workflow.status === "approved" || data.workflow.status === "rejected" ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Outcome</p>
              <h2 className="mt-1 text-lg font-semibold capitalize">{data.workflow.status}</h2>
              <p className="mt-3 text-sm text-slate-600">
                Your workflow has reached its final stage.
              </p>
            </div>
          ) : (
            <div className="text-slate-500">
              No active stage — your workflow may be complete or awaiting another party.
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
