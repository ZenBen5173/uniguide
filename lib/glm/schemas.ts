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

// ============================================================================
// coassist — natural-language "tweak this" for an artifact the coordinator
// is already looking at (letter / proposed step / briefing reasoning).
// ============================================================================

export const CoassistArtifactSchema = z.enum([
  "letter",
  "step_prompt",
  "briefing_reasoning",
]);
export type CoassistArtifact = z.infer<typeof CoassistArtifactSchema>;

export const CoassistTurnSchema = z.object({
  role: z.enum(["coordinator", "ai"]),
  text: z.string(),
});

export const CoassistInputSchema = z.object({
  artifact: CoassistArtifactSchema,
  /** The artifact's current text — for letter/step, the editable draft; for
   *  briefing_reasoning, the reasoning string from application_briefings. */
  currentText: z.string().min(1),
  /** What the coordinator wants done — natural language. */
  instruction: z.string().min(1).max(2000),
  /** Application context — name, profile, optional SOP. */
  procedureName: z.string(),
  studentProfile: StudentProfileSchema,
  sopChunks: z.array(z.string()).default([]),
  /** Optional prior coordinator-AI turns inside the same modal session,
   *  so the AI can build on its own previous revisions. */
  priorTurns: z.array(CoassistTurnSchema).default([]),
});

export const CoassistOutputSchema = z.object({
  /** For letter/step: the revised draft. For briefing_reasoning: the AI's
   *  answer to the coordinator's question (no in-place rewrite of the
   *  briefing record). */
  revised_text: z.string().min(1),
  /** One-sentence note on what changed and why — shown to the coordinator. */
  brief_explanation: z.string().min(1).max(400),
});
export type CoassistOutput = z.infer<typeof CoassistOutputSchema>;

// ============================================================================
// studentChat — always-on AI chat for the student during their application.
// AI is grounded in the SOP, the current step, and the student's history.
// May proactively suggest escalation when the answer requires human
// discretion or the student's situation isn't covered by the SOP.
// ============================================================================

export const ChatTurnSchema = z.object({
  role: z.enum(["student", "ai", "coordinator"]),
  text: z.string(),
});

export const StudentChatInputSchema = z.object({
  procedureName: z.string(),
  studentProfile: StudentProfileSchema,
  sopChunks: z.array(z.string()).default([]),
  /** The step the student is currently on (or null if they're between steps). */
  currentStepPrompt: z.string().nullable().default(null),
  /** Completed steps so far. */
  history: z.array(HistoryStepSchema).default([]),
  /** Recent chat turns in this thread (last ~10). */
  recentChat: z.array(ChatTurnSchema).default([]),
  /** The student's latest message. */
  studentMessage: z.string().min(1).max(4000),
});

export const StudentChatOutputSchema = z.object({
  /** AI's reply to the student. */
  ai_response: z.string().min(1).max(2000),
  /** Whether the AI thinks this should escalate to a human coordinator. */
  suggest_escalate: z.boolean(),
  /** When suggest_escalate=true, a one-paragraph summary of the student's
   *  situation that a coordinator can read in 5 seconds. Null otherwise. */
  escalation_summary: z.string().max(1500).nullable(),
});
export type StudentChatOutput = z.infer<typeof StudentChatOutputSchema>;

// ============================================================================
// judgeLetter — second-layer hallucination check.
//
// The regex check (in preview-letter / coassist routes) catches structural
// mismatches: wrong CGPA digit, wrong year number, unfilled placeholders.
// It can't catch *semantic* problems: the letter inventing a policy, citing
// a SOP rule that doesn't exist, contradicting the briefing's reasoning,
// or fabricating a deadline / committee name.
//
// judgeLetter runs the filled letter through GLM as an independent reviewer,
// with the briefing reasoning + SOP excerpts as ground truth. It returns a
// list of issues alongside the regex layer's. Coordinator sees both.
// ============================================================================

export const JudgeIssueSchema = z.object({
  severity: z.enum(["info", "warn", "block"]),
  /** Short tag the UI groups by — e.g. "policy", "deadline", "committee_name",
   *  "tone", "contradiction", "fabrication", "unsupported_claim". */
  category: z.string().min(1).max(40),
  /** One-sentence description of the problem the judge found. */
  message: z.string().min(1).max(400),
  /** The exact letter excerpt that triggered the issue (if any). Helps the
   *  coordinator locate it. Null when the issue is structural / non-quotable. */
  excerpt: z.string().max(400).nullable(),
});
export type JudgeIssue = z.infer<typeof JudgeIssueSchema>;

export const JudgeLetterInputSchema = z.object({
  /** The filled letter the coordinator is about to send. */
  letterText: z.string().min(1).max(20000),
  /** Type of letter — judge applies different policies to each. */
  templateType: z.enum(["acceptance", "rejection", "request_info", "custom"]),
  procedureName: z.string(),
  studentProfile: StudentProfileSchema,
  /** The briefing's reasoning text — the AI's view of the case so the
   *  judge can spot contradictions ("recommended approve but letter rejects"). */
  briefingReasoning: z.string().nullable().default(null),
  /** SOP excerpts so the judge can spot fabricated policy / deadlines. */
  sopChunks: z.array(z.string()).default([]),
  /** Optional coordinator comment that may explain a non-standard decision. */
  coordinatorComment: z.string().nullable().default(null),
});

export const JudgeLetterOutputSchema = z.object({
  /** All findings the judge has. Empty array == letter passes. */
  issues: z.array(JudgeIssueSchema).default([]),
  /** One-sentence overall read on the letter so the coordinator can scan
   *  the result without expanding details. */
  overall_assessment: z.string().min(1).max(400),
  /** Judge's confidence that the letter is faithful to the case (0..1).
   *  Used by the modal to colour the AI-Judge banner. */
  confidence: z.number().min(0).max(1),
});
export type JudgeLetterOutput = z.infer<typeof JudgeLetterOutputSchema>;
