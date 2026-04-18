/**
 * Generate plain-text email drafts based on a workflow's data.
 *
 * MVP: hardcoded templates per recipient role. Future: GLM-generated.
 */

export interface EmailDraft {
  to_role: "coordinator" | "supervisor" | "company" | "dean";
  subject: string;
  body: string;
}

export function draftCoordinatorChase(args: {
  studentName: string;
  procedureName: string;
  hoursOverdue: number;
}): EmailDraft {
  return {
    to_role: "coordinator",
    subject: `[UniGuide] ${args.procedureName} approval reminder — ${args.studentName}`,
    body:
      `Dear Coordinator,\n\n` +
      `This is a polite follow-up on my ${args.procedureName} application submitted ${args.hoursOverdue} hours ago. ` +
      `The standard SLA is 48 hours and I would appreciate your kind review at your earliest convenience.\n\n` +
      `Many thanks,\n${args.studentName}\n`,
  };
}

export function draftCompanyConfirmation(args: {
  studentName: string;
  companyName: string;
  startDate: string;
  endDate: string;
}): EmailDraft {
  return {
    to_role: "company",
    subject: `Industrial Training Confirmation — ${args.studentName}`,
    body:
      `Dear ${args.companyName} HR,\n\n` +
      `Following our prior correspondence, I am pleased to confirm my acceptance of the industrial training placement from ` +
      `${args.startDate} to ${args.endDate}.\n\n` +
      `Per Universiti Malaya's Industrial Training Office requirements, I will need a confirmation letter from your end ` +
      `for submission of form UM-PT01-PK01-BR074-S00 within two weeks of reporting.\n\n` +
      `Best regards,\n${args.studentName}\n`,
  };
}
