"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import StageNode from "./StageNode";
import DecisionNode from "./DecisionNode";
import EndNode from "./EndNode";

interface Stage {
  id: string;
  ordinal: number;
  label: string;
  node_type: "stage" | "decision" | "end";
  status: "locked" | "active" | "completed" | "skipped";
  metadata: Record<string, unknown>;
}

interface EdgeRecord {
  id: string;
  source_stage_id: string;
  target_stage_id: string;
  condition_key: string | null;
  label: string | null;
}

const nodeTypes = {
  stage: StageNode,
  decision: DecisionNode,
  end: EndNode,
};

export default function WorkflowCanvas({
  stages,
  edges,
}: {
  stages: Stage[];
  edges: EdgeRecord[];
}) {
  const nodes: Node[] = useMemo(() => {
    // Simple top-to-bottom layout. Replace with dagre for prettier graphs later.
    return stages.map((s) => ({
      id: s.id,
      type: s.node_type,
      data: { label: s.label, status: s.status, metadata: s.metadata },
      position: { x: 240 * (s.ordinal % 4), y: 160 * Math.floor(s.ordinal / 4) },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));
  }, [stages]);

  const flowEdges: Edge[] = useMemo(() => {
    return edges.map((e) => ({
      id: e.id,
      source: e.source_stage_id,
      target: e.target_stage_id,
      label: e.label ?? e.condition_key ?? undefined,
      animated: false,
      style: {
        stroke:
          e.condition_key === "blocked" || e.condition_key === "rejected"
            ? "#ef4444"
            : e.condition_key === "approved" || e.condition_key === "proceed"
            ? "#22c55e"
            : "#94a3b8",
      },
    }));
  }, [edges]);

  return (
    <ReactFlow nodes={nodes} edges={flowEdges} nodeTypes={nodeTypes} fitView>
      <Background gap={16} />
      <Controls />
    </ReactFlow>
  );
}
