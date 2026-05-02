/**
 * Zod schemas for every GLM endpoint's input and output (UniGuide v2).
 *
 * v2 architecture: AI emits the next step in an application turn-by-turn,
 * based on the SOP and prior responses. No upfront workflow planning.
 *
 * Endpoints:
 *   - extractIntent (kept; optional — students mostly pick from portal)
 *   - parseDocument (kept; runs inline on student uploads)
 *   - nextStep (NEW; emits next step in an application)
 *   - estimateProgress (NEW; rough X-of-Y indicator)
 *   - generateBriefing (kept; coordinator's view of submitted application)
 *   - fillLetter (NEW; fills .docx letter template after a decision)
 */

import { z } from "zod";

// ============================================================================
// Common
// ============================================================================
export const ProcedureIdSchema = z.enum([
  "scholarship_application",
  "final_year_project",
  "deferment_of_studies",
  "exam_result_appeal",
  "postgrad_admission",
  "emgs_visa_renewal",
]);
export type ProcedureId = z.infer<typeof ProcedureIdSchema>;

export const StepTypeSchema = z.enum([
  "form",
  "file_upload",
  "text",
  "select",
  "multiselect",
  "info",
  "final_submit",
  "coordinator_message",
]);
export type StepType = z.infer<typeof StepTypeSchema>;

export const StudentProfileSchema = z.object({
  full_name: z.string().nullable(),
  faculty: z.string().nullable(),
  programme: z.string().nullable(),
  year: z.number().int().nullable(),
  cgpa: z.number().nullable(),
  citizenship: z.string().default("MY"),
});
export type StudentProfile = z.infer<typeof StudentProfileSchema>;

// ============================================================================
// extractIntent (kept for the optional "search bar" UX on the portal)
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
// parseDocument (kept; inline on student upload)
// ============================================================================
export const ParseDocumentInputSchema = z.object({
  documentText: z.string().min(1),
  extractionSchema: z.record(z.string(), z.string()),
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
// nextStep — the heart of the v2 architecture
// ============================================================================

/** A single completed step in the running application history. */
export const HistoryStepSchema = z.object({
  ordinal: z.number().int(),
  type: StepTypeSchema,
  prompt_text: z.string(),
  emitted_by: z.enum(["ai", "coordinator"]).default("ai"),
  response_data: z.unknown().nullable(),
  parsed_attachments: z.array(
    z.object({
      filename: z.string(),
      extracted_fields: z.record(z.string(), z.unknown()).optional(),
    })
  ).optional(),
});
export type HistoryStep = z.infer<typeof HistoryStepSchema>;

export const NextStepInputSchema = z.object({
  procedureId: ProcedureIdSchema,
  procedureName: z.string(),
  studentProfile: StudentProfileSchema,
  sopChunks: z.array(z.string()).default([]),
  history: z.array(HistoryStepSchema).default([]),
  /** When non-null, this is a coordinator-typed request to inject as a step. */
  coordinatorRequest: z.string().nullable().default(null),
});
export type NextStepInput = z.infer<typeof NextStepInputSchema>;

/** Config schemas per step type — what the renderer needs. */
export const FormFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  field_type: z.enum(["text", "number", "email", "date", "textarea", "file"]),
  required: z.boolean().default(true),
  placeholder: z.string().optional(),
  /** For file fields only — accepted MIME types. */
  accepts: z.array(z.string()).optional(),
});

export const StepConfigSchema = z.object({
  // form
  fields: z.array(FormFieldSchema).optional(),
  // file_upload
  accepts: z.array(z.string()).optional(),                  // MIME patterns
  max_files: z.number().int().min(1).max(10).optional(),
  extraction_schema: z.record(z.string(), z.string()).optional(),  // for parseDocument
  // select / multiselect
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  // text
  multiline: z.boolean().optional(),
  max_length: z.number().int().optional(),
  ai_suggested_prompts: z.array(z.string()).optional(),
  // info
  body_markdown: z.string().optional(),
  // final_submit
  summary_intro: z.string().optional(),
});
export type StepConfig = z.infer<typeof StepConfigSchema>;

export const NextStepOutputSchema = z.object({
  /** True when GLM determines no more steps are needed (application is complete). */
  is_complete: z.boolean(),
  /** The next step to emit. NULL only when is_complete=true. */
  next_step: z.object({
    type: StepTypeSchema,
    prompt_text: z.string().min(1).max(1000),
    config: StepConfigSchema,
  }).nullable(),
  /** Brief reasoning for the coordinator-side audit trail. */
  reasoning: z.string().max(800),
  /** GLM's short summary of what it understands so far (used in inbox row). */
  running_summary: z.string().max(300).optional(),
  /** Citations to SOP chunks that informed this step. */
  citations: z.array(z.string()).default([]),
});
export type NextStepOutput = z.infer<typeof NextStepOutputSchema>;

// ============================================================================
// estimateProgress
// ============================================================================
export const EstimateProgressInputSchema = z.object({
  procedureId: ProcedureIdSchema,
  sopChunks: z.array(z.string()).default([]),
  stepsCompletedSoFar: z.number().int().nonnegative(),
});

export const EstimateProgressOutputSchema = z.object({
  estimated_total_steps: z.number().int().min(1).max(30),
  reasoning: z.string().max(300),
});
export type EstimateProgressOutput = z.infer<typeof EstimateProgressOutputSchema>;

// ============================================================================
// generateBriefing (kept)
// ============================================================================
export const GenerateBriefingInputSchema = z.object({
  procedureName: z.string(),
  studentProfile: StudentProfileSchema,
  history: z.array(HistoryStepSchema),
  /** Procedure SOP excerpts the AI can quote when raising flags. */
  sopChunks: z.array(z.string()).default([]),
});

export const BriefingFlagSchema = z.object({
  severity: z.enum(["info", "warn", "block"]),
  message: z.string(),
});

export const GenerateBriefingOutputSchema = z.object({
  extracted_facts: z.record(z.string(), z.unknown()),
  flags: z.array(BriefingFlagSchema).default([]),
  recommendation: z.enum(["approve", "reject", "request_info"]),
  ai_confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1).max(1500),
});
export type GenerateBriefingOutput = z.infer<typeof GenerateBriefingOutputSchema>;

// ============================================================================
// fillLetter — fill a .docx-style template with application data
// ============================================================================
export const FillLetterInputSchema = z.object({
  templateText: z.string().min(1),
  templateType: z.enum(["acceptance", "rejection", "request_info", "custom"]),
  procedureName: z.string(),
  studentProfile: StudentProfileSchema,
  applicationSummary: z.string(),                            // GLM briefing reasoning
  coordinatorComment: z.string().nullable().default(null),  // for rejections / requests
  detectedPlaceholders: z.array(z.string()).default([]),    // {{name}}, {{cgpa}}, etc.
});

export const FillLetterOutputSchema = z.object({
  filled_text: z.string().min(1),
  placeholder_values: z.record(z.string(), z.string()),
  unfilled_placeholders: z.array(z.string()).default([]),
});
export type FillLetterOutput = z.infer<typeof FillLetterOutputSchema>;
