/**
 * Demo scripts — per-procedure hardcoded "next step" fallbacks for the
 * procedures we want to demo reliably even if Z.AI is slow.
 *
 * The engine races nextStep against a 5 s timer. If the AI returns in
 * time, we use it. If the timer wins, we look up a script entry by
 * (procedureId, historyLength) and emit that instead. The student-
 * facing flow looks identical either way.
 *
 * To the audit trail we still write a `next_step` trace when the
 * script is used, with a marker in inputSummary.source so admins can
 * tell the two paths apart in /admin/glm-traces. Coordinators and
 * students never see this distinction.
 */

import type { StepType } from "@/lib/glm/schemas";

interface ScriptEntry {
  type: StepType;
  prompt_text: string;
  config: Record<string, unknown>;
  reasoning: string;
  citations?: string[];
  running_summary?: string;
}

const SCRIPTS: Record<string, Record<number, ScriptEntry>> = {
  /**
   * Final Year Project demo path. Seed places this app in draft with
   * two completed steps (intake select + form) and a pending file_upload.
   * The student uploads, then the engine emits this final_submit step
   * with the acknowledgment copy in summary_intro — one click submits.
   */
  final_year_project: {
    // historyLength = 3 (after file_upload completes).
    3: {
      type: "final_submit",
      prompt_text:
        "Acknowledge and submit your FYP I registration.",
      config: {
        summary_intro:
          "Final check before you submit. By clicking Submit application, " +
          "you confirm:\n\n" +
          "• Your supervisor has reviewed and signed off on the proposal.\n" +
          "• You have read the FSKTM FYP I handbook.\n" +
          "• Any human-subjects research will have UMREC ethics approval " +
          "before data collection begins.\n\n" +
          "Once submitted, the FYP Coordinator will review and respond " +
          "through your portal here.",
      },
      reasoning:
        "All required documents are uploaded; final pre-submission " +
        "acknowledgment of the FSKTM FYP I handbook and ethics expectations " +
        "is the last step before the Coordinator review.",
      citations: ["Documents Required", "Ethics Tier"],
      running_summary:
        "Year 3 FSKTM student, FYP I (AD category). Supervisor confirmed; " +
        "proposal + signed FYP-1 form uploaded. Ethics tier: standard. " +
        "Ready for final review.",
    },
  },
};

/**
 * Look up a script entry for a given procedure + history position.
 * Returns null when no entry is defined; callers should then trust the
 * full AI path with no race.
 */
export function getDemoScriptStep(
  procedureId: string,
  historyLength: number
): ScriptEntry | null {
  return SCRIPTS[procedureId]?.[historyLength] ?? null;
}

/**
 * Convenience: how long to wait for the AI before falling back to the
 * script. Kept here so it lives next to the script definitions.
 */
export const DEMO_SCRIPT_RACE_MS = 5_000;
