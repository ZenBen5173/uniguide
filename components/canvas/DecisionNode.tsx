"use client";

import { Handle, Position } from "reactflow";

export default function DecisionNode({
  data,
}: {
  data: { label: string; status: string };
}) {
  const isActive = data.status === "active";
  const isDone = data.status === "completed";
  return (
    <div
      className={`flex min-w-[160px] items-center justify-center rounded-full border-2 px-5 py-3 text-center text-sm font-medium ${
        isActive
          ? "border-amber-500 bg-amber-50 text-amber-900 shadow-md"
          : isDone
          ? "border-amber-300 bg-amber-50/60 text-amber-700"
          : "border-amber-200 bg-white text-slate-600"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-300" />
      <span className="leading-tight">⬢ {data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-300" />
    </div>
  );
}
