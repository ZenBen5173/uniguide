"use client";

import { Handle, Position } from "reactflow";

export default function EndNode({
  data,
}: {
  data: { label: string; status: string; metadata: { outcome?: string } };
}) {
  const outcome = data.metadata?.outcome ?? "completed";
  const isReached = data.status === "completed" || data.status === "active";

  const colour =
    outcome === "rejected"
      ? "border-red-300 bg-red-50 text-red-900"
      : outcome === "cancelled"
      ? "border-slate-300 bg-slate-50 text-slate-700"
      : "border-emerald-400 bg-emerald-50 text-emerald-900";

  return (
    <div
      className={`flex h-20 w-20 items-center justify-center rounded-full border-2 text-center text-xs font-medium ${colour} ${
        isReached ? "shadow-md" : "opacity-60"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <span className="leading-tight">{data.label}</span>
    </div>
  );
}
