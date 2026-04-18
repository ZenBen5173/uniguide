/**
 * Generate plain-text email drafts based on a workflow's data.
 *
 * MVP: hardcoded templates per recipient role. Future: GLM-generated.
 */

export interface EmailDraft {
  to_role: "coordinator" | "supervisor" | "scholarship_office" | "dean";
  subject: string;
  body: string;
}

export function draftCoordinatorChase(args: {
  studentName: string;
  procedureName: string;
  daysOverdue: number;
}): EmailDraft {
  return {
    to_role: "coordinator",
    subject: `[UniGuide] ${args.procedureName} reminder — ${args.studentName}`,
    body:
      `Dear Officer,\n\n` +
      `This is a polite follow-up on my ${args.procedureName} application, submitted ${args.daysOverdue} days ago. ` +
      `Could I kindly check on the current status? I appreciate your time and the volume of applications you handle.\n\n` +
      `Many thanks,\n${args.studentName}\n`,
  };
}

export function draftYayasanUmStatement(args: {
  studentName: string;
  faculty: string;
  cgpa: number;
  incomeTier: string;
}): EmailDraft {
  return {
    to_role: "scholarship_office",
    subject: `Yayasan UM Scholarship — Personal Statement — ${args.studentName}`,
    body:
      `Dear Yayasan UM Committee,\n\n` +
      `I am ${args.studentName}, currently in ${args.faculty}, with a cumulative CGPA of ${args.cgpa.toFixed(2)}. ` +
      `My family is in the ${args.incomeTier} income tier and a Yayasan UM scholarship would be a meaningful contribution ` +
      `toward my continued studies at Universiti Malaya.\n\n` +
      `I have attached my latest transcript, parents' income proof, and a 700-word motivation letter that details my ` +
      `circumstances, academic goals, and how I plan to maintain the CGPA threshold required for renewal.\n\n` +
      `Thank you for considering my application.\n\nSincerely,\n${args.studentName}\n`,
  };
}
