/**
 * Domain types for the workflow engine.
 *
 * These types mirror the database schema (see supabase/migrations/0001_*.sql)
 * and are populated from the GLM-emitted plan (see lib/glm/schemas.ts).
 */

export type WorkflowStatus =
  | "planning"
  | "active"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled";

export type StageStatus = "locked" | "active" | "completed" | "skipped";
export type StepStatus = "pending" | "completed" | "skipped";
export type NodeType = "stage" | "decision" | "end";
export type StepType = "form" | "upload" | "approval" | "notification" | "conditional";

export type AssigneeRole = "student" | "coordinator" | "dean" | "dvc" | "ips_officer" | "system";

export interface WorkflowRecord {
  id: string;
  user_id: string;
  procedure_id: string;
  status: WorkflowStatus;
  intent_text: string | null;
  plan_snapshot: unknown;
  created_at: string;
  updated_at: string;
}

export interface StageRecord {
  id: string;
  workflow_id: string;
  ordinal: number;
  label: string;
  node_type: NodeType;
  status: StageStatus;
  assignee_role: AssigneeRole | null;
  metadata: Record<string, unknown>;
}

export interface StepRecord {
  id: string;
  stage_id: string;
  ordinal: number;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
  required: boolean;
  status: StepStatus;
}

export interface EdgeRecord {
  id: string;
  workflow_id: string;
  source_stage_id: string;
  target_stage_id: string;
  condition_key: string | null;
  label: string | null;
}

export interface StepResponseRecord {
  id: string;
  step_id: string;
  user_id: string;
  response_data: Record<string, unknown>;
  responded_at: string;
}
