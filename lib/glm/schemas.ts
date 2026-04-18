/**
 * Zod schemas for every GLM endpoint's input and output.
 *
 * These schemas serve three roles:
 *   1. Runtime validation of GLM responses (catch malformed JSON, bad enum values).
 *   2. TypeScript types via z.infer<typeof Schema>.
 *   3. Documentation of the contract between GLM and the rest of the system.
 *
 * If GLM's output fails schema validation, the call is retried once with a
 * corrective system-prompt addendum. See lib/glm/client.ts.
 */

import { z } from "zod";

// ============================================================================
// Common
// ============================================================================
export const ProcedureIdSchema = z.enum([
  "industrial_training",
  "final_year_project",
  "deferment_of_studies",
  "exam_result_appeal",
  "postgrad_admission",
  "emgs_visa_renewal",
]);
export type ProcedureId = z.infer<typeof ProcedureIdSchema>;

// ============================================================================
// extractIntent
// ============================================================================
export const ExtractIntentInputSchema = z.object({
  text: z.string().min(1).max(4000),
  availableProcedureIds: z.array(ProcedureIdSchema).min(1),
});
export type ExtractIntentInput = z.infer<typeof ExtractIntentInputSchema>;

export const ExtractIntentOutputSchema = z.object({
  procedure_id: ProcedureIdSchema.nullable(),
  confidence: z.number().min(0).max(1),
  clarifying_questions: z.array(z.string()).max(3),
  reasoning: z.string().max(500),
});
export type ExtractIntentOutput = z.infer<typeof ExtractIntentOutputSchema>;

// ============================================================================
// planWorkflow
// ============================================================================
export const StudentProfileSchema = z.object({
  faculty: z.string().nullable(),
  programme: z.string().nullable(),
  year: z.number().int().nullable(),
  cgpa: z.number().nullable(),
  citizenship: z.string().default("MY"),
});
export type StudentProfile = z.infer<typeof StudentProfileSchema>;

export const PlanStageSchema = z.object({
  ordinal: z.number().int().nonnegative(),
  label: z.string().min(1),
  node_type: z.enum(["stage", "decision", "end"]),
  assignee_role: z
    .enum(["student", "coordinator", "dean", "dvc", "ips_officer", "system"])
    .nullable(),
  steps: z.array(
    z.object({
      ordinal: z.number().int().nonnegative(),
      type: z.enum(["form", "upload", "approval", "notification", "conditional"]),
      label: z.string().min(1),
      required: z.boolean().default(true),
      config: z.record(z.string(), z.unknown()).default({}),
    })
  ),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type PlanStage = z.infer<typeof PlanStageSchema>;

export const PlanEdgeSchema = z.object({
  source_ordinal: z.number().int().nonnegative(),
  target_ordinal: z.number().int().nonnegative(),
  condition_key: z.string().nullable(),
  label: z.string().nullable(),
});
export type PlanEdge = z.infer<typeof PlanEdgeSchema>;

export const PlanWorkflowInputSchema = z.object({
  procedureId: ProcedureIdSchema,
  profile: StudentProfileSchema,
  intentText: z.string().nullable(),
  sopChunks: z.array(z.string()).default([]),
});
export type PlanWorkflowInput = z.infer<typeof PlanWorkflowInputSchema>;

export const PlanWorkflowOutputSchema = z.object({
  procedure_id: ProcedureIdSchema,
  stages: z.array(PlanStageSchema).min(2),
  edges: z.array(PlanEdgeSchema),
  deadlines: z.array(
    z.object({
      stage_ordinal: z.number().int(),
      label: z.string(),
      iso_date: z.string().nullable(),
      relative_days: z.number().int().nullable(),
    })
  ).default([]),
  reasoning: z.string().max(1500),
});
export type PlanWorkflowOutput = z.infer<typeof PlanWorkflowOutputSchema>;

// ============================================================================
// adaptStep
// ============================================================================
export const AdaptStepInputSchema = z.object({
  step: z.object({
    type: z.string(),
    label: z.string(),
    config: z.record(z.string(), z.unknown()),
  }),
  profile: StudentProfileSchema,
  priorResponses: z.record(z.string(), z.unknown()).default({}),
});

export const AdaptStepOutputSchema = z.object({
  question_text: z.string().min(1).max(800),
  expected_response_type: z.enum(["text", "select", "file", "yesno", "number"]),
  context_hint: z.string().nullable(),
  options: z.array(z.string()).optional(),
});
export type AdaptStepOutput = z.infer<typeof AdaptStepOutputSchema>;

// ============================================================================
// routeDecision
// ============================================================================
export const RouteDecisionInputSchema = z.object({
  decisionNode: z.object({
    label: z.string(),
    branches: z.array(
      z.object({
        condition_key: z.string(),
        target_label: z.string(),
        criteria: z.string(),
      })
    ),
  }),
  priorResponses: z.array(
    z.object({
      step_label: z.string(),
      response: z.unknown(),
    })
  ),
});

export const RouteDecisionOutputSchema = z.object({
  selected_condition_key: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(800),
  citations: z.array(z.string()).default([]),
  needs_clarification: z.boolean().default(false),
  clarification_question: z.string().nullable(),
});
export type RouteDecisionOutput = z.infer<typeof RouteDecisionOutputSchema>;

// ============================================================================
// parseDocument
// ============================================================================
export const ParseDocumentInputSchema = z.object({
  documentText: z.string().min(1),
  extractionSchema: z.record(z.string(), z.string()),
  // ^ field name -> description, e.g. { company_name: "Name of the company offering placement" }
});

export const ParseDocumentOutputSchema = z.object({
  fields: z.record(
    z.string(),
    z.object({
      value: z.union([z.string(), z.number(), z.null()]),
      confidence: z.number().min(0).max(1),
    })
  ),
  source_excerpt: z.string().nullable(),
});
export type ParseDocumentOutput = z.infer<typeof ParseDocumentOutputSchema>;

// ============================================================================
// generateBriefing
// ============================================================================
export const GenerateBriefingInputSchema = z.object({
  workflowSummary: z.string(),
  responses: z.array(
    z.object({
      step_label: z.string(),
      response_data: z.unknown(),
    })
  ),
  procedureName: z.string(),
});

export const BriefingFlagSchema = z.object({
  severity: z.enum(["info", "warn", "block"]),
  message: z.string(),
});

export const GenerateBriefingOutputSchema = z.object({
  extracted_facts: z.record(z.string(), z.unknown()),
  flags: z.array(BriefingFlagSchema).default([]),
  recommendation: z.enum(["approve", "reject", "request_info"]),
  reasoning: z.string().min(1).max(1500),
});
export type GenerateBriefingOutput = z.infer<typeof GenerateBriefingOutputSchema>;
