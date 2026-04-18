/**
 * Step type registry for UniGuide v2.
 *
 * Pattern adapted from FlowNote's config-driven step types — but written fresh,
 * adapted for the AI-emits-steps-turn-by-turn model. Each step type maps to:
 *   1. A renderer component name (resolved at component time)
 *   2. A response shape (what `application_steps.response_data` looks like
 *      when this step is completed)
 *   3. Validation rules
 *   4. Display metadata (icon, label) for the timeline view
 *
 * AI is allowed to emit any of these types in `nextStep`. If we ever add a
 * new type, register it here and add a renderer component.
 */

import type { StepType } from "@/lib/glm/schemas";

export interface StepTypeMeta {
  /** Internal identifier — must match StepTypeSchema enum value. */
  id: StepType;
  /** Human-readable label for inbox / timeline. */
  label: string;
  /** Lucide icon name for badges. */
  icon: string;
  /** Component name (resolved by the StepRenderer at render time). */
  renderer: string;
  /** Whether this step requires user input (false = auto-completes / display-only). */
  needsUserInput: boolean;
  /** What `response_data` looks like when completed. */
  responseShape: string;
}

export const STEP_TYPES: Record<StepType, StepTypeMeta> = {
  form: {
    id: "form",
    label: "Form",
    icon: "FormInput",
    renderer: "FormStep",
    needsUserInput: true,
    responseShape: "{ [field_key: string]: string | number | null }",
  },
  file_upload: {
    id: "file_upload",
    label: "Upload",
    icon: "Upload",
    renderer: "UploadStep",
    needsUserInput: true,
    responseShape: "{ files: Array<{ attachment_id: string; filename: string; extracted_fields?: object }> }",
  },
  text: {
    id: "text",
    label: "Text",
    icon: "Type",
    renderer: "TextStep",
    needsUserInput: true,
    responseShape: "{ text: string }",
  },
  select: {
    id: "select",
    label: "Select",
    icon: "ChevronDown",
    renderer: "SelectStep",
    needsUserInput: true,
    responseShape: "{ value: string }",
  },
  multiselect: {
    id: "multiselect",
    label: "Multi-select",
    icon: "CheckSquare",
    renderer: "MultiselectStep",
    needsUserInput: true,
    responseShape: "{ values: string[] }",
  },
  info: {
    id: "info",
    label: "Info",
    icon: "Info",
    renderer: "InfoStep",
    needsUserInput: true,
    responseShape: "{ acknowledged: true }",
  },
  final_submit: {
    id: "final_submit",
    label: "Submit",
    icon: "Send",
    renderer: "FinalSubmitStep",
    needsUserInput: true,
    responseShape: "{ confirmed: true }",
  },
  coordinator_message: {
    id: "coordinator_message",
    label: "From Coordinator",
    icon: "MessageSquare",
    renderer: "CoordinatorMessageStep",
    needsUserInput: true,
    responseShape: "{ student_response: string; attachments?: Array<{...}> }",
  },
};

/** Convenience: all step type IDs as an array (matches StepTypeSchema enum order). */
export const ALL_STEP_TYPES = Object.keys(STEP_TYPES) as StepType[];

/** Step types AI is allowed to emit autonomously (not coordinator_message). */
export const AI_EMITTABLE_STEP_TYPES: StepType[] = [
  "form",
  "file_upload",
  "text",
  "select",
  "multiselect",
  "info",
  "final_submit",
];
