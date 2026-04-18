"use client";

import { Handle, Position } from "reactflow";

const STATUS_STYLES: Record<string, string> = {
  locked: "border-slate-200 bg-white text-slate-500",
  active: "border-brand-500 bg-brand-50 text-brand-900 shadow-md",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
  skipped: "border-slate-200 bg-slate-100 text-slate-400 line-through",
};

export default function StageNode({
  data,
}: {
  data: { label: string; status: string };
}) {
  const style = STATUS_STYLES[data.status] ?? STATUS_STYLES.locked;
  return (
    <div className={`min-w-[180px] rounded-lg border-2 px-4 py-3 text-sm font-medium ${style}`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  );
}
