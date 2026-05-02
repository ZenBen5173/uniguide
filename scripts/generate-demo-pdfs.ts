/**
 * Generates realistic dummy supporting-document PDFs for the UniGuide demo.
 *
 * These are intentionally hand-crafted to match the `extraction_schema`
 * fields the AI emits in the next-step fixtures, so a live demo can
 * showcase the upload → extract → AI-skips-re-asking loop end-to-end.
 *
 * Output: tests/fixtures/sample-documents/*.pdf
 *
 * Run: npx tsx scripts/generate-demo-pdfs.ts
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import * as fs from "fs";
import * as path from "path";

// pdfkit is a CommonJS module without proper ESM defaults — require directly.
const PDFDocument = require("pdfkit");

const OUT_DIR = path.resolve(__dirname, "..", "tests", "fixtures", "sample-documents");
fs.mkdirSync(OUT_DIR, { recursive: true });

interface DocSpec {
  filename: string;
  build: (doc: PDFKit.PDFDocument) => void;
}

const docs: DocSpec[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// 1. EPF Statement — for scholarship income-proof demo (B40 case)
// Maps to parse_income_proof.json fixture.
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "01_epf_statement_b40.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(18).text("KUMPULAN WANG SIMPANAN PEKERJA", { align: "center" });
    d.font("Helvetica").fontSize(11).text("Employees Provident Fund (EPF) — Penyata Caruman Bulanan", { align: "center" });
    d.moveDown(0.5);
    d.fontSize(9).fillColor("#666").text("Tingkat Bawah, Bangunan KWSP, Jalan Raja Laut, 50350 Kuala Lumpur", { align: "center" });
    d.fillColor("black");
    d.moveDown(1.5);

    d.font("Helvetica-Bold").fontSize(12).text("Penyata Caruman Bulanan / Monthly Contribution Statement");
    d.moveDown(0.5);

    d.font("Helvetica").fontSize(10);
    d.text("Account Holder Name: Ali bin Hassan");
    d.text("Account Number: 1234-5678-9012");
    d.text("IC No: 750821-08-1234");
    d.text("Statement Period: 2025-10-01 to 2026-03-31");
    d.text("Date Issued: 2026-04-05");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Monthly Contributions / Caruman Bulanan");
    d.moveDown(0.3);

    const rows = [
      ["October 2025", "RM 420.00", "RM 230.00", "RM 650.00"],
      ["November 2025", "RM 420.00", "RM 230.00", "RM 650.00"],
      ["December 2025", "RM 420.00", "RM 230.00", "RM 650.00"],
      ["January 2026", "RM 420.00", "RM 230.00", "RM 650.00"],
      ["February 2026", "RM 420.00", "RM 230.00", "RM 650.00"],
      ["March 2026", "RM 420.00", "RM 230.00", "RM 650.00"],
    ];
    d.font("Helvetica").fontSize(9);
    d.text("Period                  Employee (11%)    Employer (12%)    Total");
    d.moveDown(0.2);
    for (const r of rows) {
      d.text(`${r[0].padEnd(22)}${r[1].padEnd(18)}${r[2].padEnd(18)}${r[3]}`);
    }
    d.moveDown(0.8);

    d.font("Helvetica-Bold").fontSize(10).text("Summary");
    d.font("Helvetica").fontSize(10);
    d.text("Average monthly employee contribution: RM 420.00");
    d.text("Equivalent estimated monthly gross income: approx. RM 3,800");
    d.text("(Calculated using statutory EPF rate of 11% on monthly wages.)");
    d.text("Inferred income tier (per DOSM 2026 thresholds): B40");
    d.moveDown(1);

    d.fontSize(9).fillColor("#666");
    d.text("This is an officially generated statement. No signature required.");
    d.text("For verification, scan the QR code or visit kwsp.gov.my/verify with reference 8829-AHX-2026.");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EPF Statement — M40 / borderline case (for the "AI confirms before
//    advancing" path when confidence is moderate)
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "02_epf_statement_m40_borderline.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(18).text("KUMPULAN WANG SIMPANAN PEKERJA", { align: "center" });
    d.font("Helvetica").fontSize(11).text("Employees Provident Fund (EPF) — Penyata Caruman Bulanan", { align: "center" });
    d.moveDown(0.5);
    d.fontSize(9).fillColor("#666").text("Tingkat Bawah, Bangunan KWSP, Jalan Raja Laut, 50350 Kuala Lumpur", { align: "center" });
    d.fillColor("black");
    d.moveDown(1.5);

    d.font("Helvetica").fontSize(10);
    d.text("Account Holder Name: Lim Wei Chen");
    d.text("Account Number: 9876-5432-1098");
    d.text("IC No: 740415-10-5678");
    d.text("Statement Period: 2025-10-01 to 2026-03-31");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Monthly Contributions");
    d.moveDown(0.3);
    d.font("Helvetica").fontSize(9);
    d.text("Period                  Employee (11%)    Employer (12%)    Total");
    const rows = [
      ["October 2025",  "RM 825.00", "RM 450.00", "RM 1,275.00"],
      ["November 2025", "RM 825.00", "RM 450.00", "RM 1,275.00"],
      ["December 2025", "RM 825.00", "RM 450.00", "RM 1,275.00"],
      ["January 2026",  "RM 825.00", "RM 450.00", "RM 1,275.00"],
      ["February 2026", "RM 825.00", "RM 450.00", "RM 1,275.00"],
      ["March 2026",    "RM 825.00", "RM 450.00", "RM 1,275.00"],
    ];
    for (const r of rows) {
      d.text(`${r[0].padEnd(22)}${r[1].padEnd(18)}${r[2].padEnd(18)}${r[3]}`);
    }
    d.moveDown(0.8);

    d.font("Helvetica-Bold").fontSize(10).text("Summary");
    d.font("Helvetica").fontSize(10);
    d.text("Average monthly employee contribution: RM 825.00");
    d.text("Equivalent estimated monthly gross income: approx. RM 7,500");
    d.text("Inferred income tier (per DOSM 2026 thresholds): M40 (lower)");
    d.moveDown(1);

    d.fontSize(9).fillColor("#666").text("Reference: 8829-LWC-2026 · kwsp.gov.my/verify");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Latest semester academic transcript — UM, BCS programme, year 3
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "03_um_transcript_latest_semester.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(18).text("UNIVERSITI MALAYA", { align: "center" });
    d.font("Helvetica").fontSize(10).text("Faculty of Computer Science and Information Technology", { align: "center" });
    d.moveDown(0.3);
    d.fontSize(9).fillColor("#666").text("50603 Kuala Lumpur · pejabat@fsktm.um.edu.my", { align: "center" });
    d.fillColor("black");
    d.moveDown(1.2);

    d.font("Helvetica-Bold").fontSize(13).text("Academic Transcript — Latest Semester");
    d.moveDown(0.5);

    d.font("Helvetica").fontSize(10);
    d.text("Student Name: Aisha binti Rahman");
    d.text("Matric No: WIA210045");
    d.text("Programme: Bachelor of Computer Science (Software Engineering)");
    d.text("Year of Study: 3");
    d.text("Semester: Semester 1, Session 2025/2026");
    d.text("Date Issued: 2026-04-15");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Courses & Grades");
    d.moveDown(0.3);
    d.font("Helvetica").fontSize(9.5);
    d.text("Code     Course Title                                                    Cr  Grade");
    const courses = [
      ["WIA3001", "Software Engineering Project Management", "3", "A"],
      ["WIA3002", "Database Systems II", "3", "A-"],
      ["WIA3003", "Mobile Application Development", "3", "A"],
      ["WIA3004", "Artificial Intelligence", "3", "A"],
      ["WIA3005", "Computer Networks", "3", "A-"],
      ["WIA3060", "Industrial Training (Pre-FYP)", "2", "A"],
    ];
    for (const c of courses) {
      d.text(`${c[0].padEnd(9)}${c[1].padEnd(64)}${c[2].padEnd(4)}${c[3]}`);
    }
    d.moveDown(0.8);

    d.font("Helvetica-Bold").fontSize(11).text("Academic Standing");
    d.font("Helvetica").fontSize(10);
    d.text("Semester GPA: 3.85");
    d.text("Cumulative GPA (CGPA): 3.80");
    d.text("Total Credits Earned: 96 / 120 (programme total)");
    d.text("Standing: GOOD STANDING — Dean's List Sem 1 2025/2026");
    d.moveDown(1);

    d.fontSize(9).fillColor("#666");
    d.text("This transcript is generated electronically. For verification visit");
    d.text("um.edu.my/transcript-verify with reference TR-2026-WIA210045-S1.");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Borderline transcript — for hardship/below-threshold scholarship case
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "04_um_transcript_borderline.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(18).text("UNIVERSITI MALAYA", { align: "center" });
    d.font("Helvetica").fontSize(10).text("Faculty of Engineering", { align: "center" });
    d.moveDown(1.5);

    d.font("Helvetica-Bold").fontSize(13).text("Academic Transcript — Latest Semester");
    d.moveDown(0.5);

    d.font("Helvetica").fontSize(10);
    d.text("Student Name: Muhammad Hafiz bin Zainuddin");
    d.text("Matric No: KQI210210");
    d.text("Programme: Bachelor of Engineering (Mechanical)");
    d.text("Year of Study: 3");
    d.text("Semester: Semester 1, Session 2025/2026");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Courses & Grades");
    d.font("Helvetica").fontSize(9.5);
    d.text("Code     Course Title                                                    Cr  Grade");
    const courses = [
      ["KQI3001", "Thermodynamics II", "4", "B-"],
      ["KQI3002", "Fluid Mechanics", "4", "C+"],
      ["KQI3003", "Machine Design", "3", "B"],
      ["KQI3004", "Engineering Mathematics III", "3", "B+"],
      ["KQI3005", "Manufacturing Processes", "3", "B"],
    ];
    for (const c of courses) {
      d.text(`${c[0].padEnd(9)}${c[1].padEnd(64)}${c[2].padEnd(4)}${c[3]}`);
    }
    d.moveDown(0.8);

    d.font("Helvetica-Bold").fontSize(11).text("Academic Standing");
    d.font("Helvetica").fontSize(10);
    d.text("Semester GPA: 2.85");
    d.text("Cumulative GPA (CGPA): 2.78");
    d.text("Total Credits Earned: 89 / 132 (programme total)");
    d.text("Standing: ACADEMIC PROBATION — referred to faculty advisor");
    d.moveDown(1);

    d.fontSize(9).fillColor("#666").text("Reference: TR-2026-KQI210210-S1");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Hardship letter from parent (supports below-threshold scholarship case)
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "05_parent_hardship_letter.pdf",
  build: (d) => {
    d.font("Helvetica").fontSize(10);
    d.text("Zainuddin bin Yusof");
    d.text("No. 14, Jalan Permata 3,");
    d.text("Taman Permata, 43500 Semenyih, Selangor");
    d.text("Email: zainy.yusof@example.com · Tel: 012-345-6789");
    d.moveDown(1);
    d.text("Date: 12 April 2026");
    d.moveDown(1);
    d.text("To: Scholarship Committee");
    d.text("Hal Ehwal Pelajar (HEP), Universiti Malaya");
    d.text("50603 Kuala Lumpur");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Re: Application for Financial Hardship Consideration — Muhammad Hafiz bin Zainuddin (KQI210210)");
    d.moveDown(0.5);
    d.font("Helvetica").fontSize(10.5);
    d.text("Dear Sir/Madam,");
    d.moveDown(0.5);

    d.text(
      "I am writing in support of my son's application for financial assistance for the academic session 2025/2026. " +
      "I respectfully request that the committee consider his case despite his current CGPA of 2.78, which is below " +
      "the typical Yayasan UM threshold of 3.00."
    );
    d.moveDown(0.5);
    d.text(
      "In November 2025, I was made redundant from my position of 18 years at Permatang Manufacturing Sdn. Bhd. " +
      "Since then I have been seeking re-employment. My wife is a homemaker. Our combined household income now " +
      "consists of intermittent freelance work (~RM 1,800/month) and EPF withdrawals approved on hardship grounds " +
      "(approved Q1 2026 — copy attached separately)."
    );
    d.moveDown(0.5);
    d.text(
      "Hafiz has been balancing his studies with part-time tutoring (approximately 12 hours/week, ~RM 600/month) to " +
      "contribute to household expenses. The strain has affected his academic performance — particularly in " +
      "Thermodynamics II and Fluid Mechanics last semester — but he is committed to recovering his standing in " +
      "Semester 2 with a reduced workload now that EPF disbursements have stabilised our situation."
    );
    d.moveDown(0.5);
    d.text(
      "I would be deeply grateful if the committee could review his case in light of these circumstances. The financial " +
      "support would directly reduce the hours he needs to work outside class and allow him to focus on rebuilding his " +
      "CGPA. I am happy to provide additional documentation including my retrenchment letter and recent bank statements."
    );
    d.moveDown(1);
    d.text("Yours sincerely,");
    d.moveDown(1.5);
    d.text("Zainuddin bin Yusof");
    d.text("(Father — IC: 670512-08-7234)");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. FYP supervisor confirmation letter
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "06_fyp_supervisor_confirmation.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(16).text("UNIVERSITI MALAYA", { align: "center" });
    d.font("Helvetica").fontSize(10).text("Faculty of Computer Science and Information Technology", { align: "center" });
    d.moveDown(0.3);
    d.fontSize(9).fillColor("#666").text("Department of Software Engineering", { align: "center" });
    d.fillColor("black");
    d.moveDown(1.5);

    d.font("Helvetica").fontSize(10);
    d.text("Date: 18 April 2026");
    d.text("Ref: FSKTM/SE/FYP/2026-0445");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Final Year Project Supervisor Confirmation");
    d.moveDown(0.5);
    d.font("Helvetica").fontSize(10.5);

    d.text("This letter confirms that:");
    d.moveDown(0.3);
    d.text("Student: Aisha binti Rahman (WIA210045)");
    d.text("Programme: Bachelor of Computer Science (Software Engineering), Year 3");
    d.moveDown(0.3);
    d.text("has been formally accepted as a Final Year Project (FYP) student under my supervision for the academic session 2026/2027 with the following project details:");
    d.moveDown(0.5);
    d.text("Project Title: AI-Assisted Triage System for University Administrative Workflows");
    d.text("Domain: Applied Artificial Intelligence / Human-Computer Interaction");
    d.text("Expected Completion: April 2027 (FYP-2 final submission)");
    d.text("Co-supervisor: Dr. Tan Mei Lin (subject to consent)");
    d.moveDown(0.8);

    d.text(
      "The student has demonstrated strong academic standing (CGPA 3.80) and prior research interest aligned with " +
      "the project's scope. I have explained the FYP guidelines and timeline as per the FSKTM FYP Handbook 2026, " +
      "and the student has agreed to the milestones outlined therein."
    );
    d.moveDown(0.5);
    d.text(
      "This letter serves as the supervisor confirmation required by §3.2 of the FSKTM FYP SOP for the student's " +
      "online FYP registration submission."
    );
    d.moveDown(1.5);

    d.text("Yours sincerely,");
    d.moveDown(1.5);
    d.font("Helvetica-Bold").text("Dr. Rashid bin Abdullah");
    d.font("Helvetica").text("Senior Lecturer, Department of Software Engineering");
    d.text("rashid.abdullah@um.edu.my · 03-7967-XXXX");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Medical certificate (deferment use case)
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "07_medical_certificate_deferment.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(15).text("UNIVERSITY MALAYA MEDICAL CENTRE", { align: "center" });
    d.font("Helvetica").fontSize(10).text("Pusat Perubatan Universiti Malaya (PPUM)", { align: "center" });
    d.fontSize(9).fillColor("#666").text("Lembah Pantai, 59100 Kuala Lumpur · 03-7949-XXXX", { align: "center" });
    d.fillColor("black");
    d.moveDown(1.5);

    d.font("Helvetica-Bold").fontSize(13).text("MEDICAL CERTIFICATE", { align: "center" });
    d.font("Helvetica").fontSize(9).fillColor("#666").text("Sijil Cuti Sakit", { align: "center" });
    d.fillColor("black");
    d.moveDown(1);

    d.font("Helvetica").fontSize(10.5);
    d.text("MC No: PPUM/2026/04/15-887");
    d.text("Date Issued: 15 April 2026");
    d.moveDown(0.8);

    d.text("This is to certify that:");
    d.moveDown(0.3);
    d.text("Patient Name: Nur Aliya binti Ismail");
    d.text("IC No: 020314-14-5678");
    d.text("Matric No (UM): WID220098");
    d.text("Date of Birth: 14 March 2002");
    d.moveDown(0.5);

    d.text(
      "has been examined by me at the University Malaya Medical Centre, and is medically unfit to continue her " +
      "studies for the period of:"
    );
    d.moveDown(0.3);
    d.font("Helvetica-Bold");
    d.text("    From: 1 May 2026    To: 31 October 2026   (6 months / 1 academic semester)");
    d.font("Helvetica");
    d.moveDown(0.5);

    d.text(
      "The patient has been diagnosed with a medical condition that requires sustained outpatient treatment and " +
      "rest. Resumption of full-time studies in this period is not advised. Periodic follow-up reviews are " +
      "scheduled monthly. A return-to-study assessment will be issued before resumption of studies."
    );
    d.moveDown(0.5);

    d.text(
      "This certificate is issued in support of an application for deferment of studies under the UM Academic " +
      "Regulations §6.4(a) on grounds of medical necessity."
    );
    d.moveDown(1.5);

    d.text("Examining Physician:");
    d.moveDown(1.2);
    d.font("Helvetica-Bold").text("Dr. Faridah binti Mohd Yusof");
    d.font("Helvetica").text("MMC No: 12345 · APC: PPUM/2024/4421");
    d.text("Department of Internal Medicine, PPUM");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Exam result appeal supporting note (final-exam outcome)
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "08_exam_result_official_notice.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(16).text("UNIVERSITI MALAYA", { align: "center" });
    d.font("Helvetica").fontSize(10).text("Bahagian Akademik · Academic Division", { align: "center" });
    d.moveDown(1.5);

    d.font("Helvetica-Bold").fontSize(13).text("OFFICIAL EXAMINATION RESULT NOTICE");
    d.moveDown(0.5);

    d.font("Helvetica").fontSize(10);
    d.text("Reference: BA/2026/EXM/RES-3398");
    d.text("Date Issued: 28 March 2026");
    d.moveDown(0.5);

    d.text("Student Name: Tan Wei Jie");
    d.text("Matric No: U2102345/1");
    d.text("Programme: Bachelor of Business Administration (Finance)");
    d.text("Course: BIB3014 — Investment Analysis");
    d.text("Examination: Final Exam, Semester 1, Session 2025/2026");
    d.text("Examination Date: 22 January 2026");
    d.moveDown(0.8);

    d.font("Helvetica-Bold").fontSize(11).text("Result");
    d.font("Helvetica").fontSize(10);
    d.text("Coursework component: 41 / 60");
    d.text("Final exam component: 18 / 40");
    d.text("Total raw score: 59 / 100");
    d.text("Final grade: C");
    d.text("Grade point: 2.00");
    d.moveDown(0.8);

    d.text(
      "Per UM examination policy §11.4, students who have grounds to dispute a final-exam result may submit a " +
      "formal Examination Result Appeal within 14 calendar days of the official release date. Appeals must be " +
      "supported by either: (a) evidence of a procedural error in the examination, (b) evidence of a marking " +
      "discrepancy, or (c) extenuating circumstances during the exam period that were not previously declared."
    );
    d.moveDown(0.5);
    d.text(
      "Release of this notice constitutes the start of the 14-day appeal window. Late appeals will not be " +
      "considered except in cases of demonstrable hardship."
    );
    d.moveDown(1.5);

    d.fontSize(9).fillColor("#666").text("Bahagian Akademik · ba@um.edu.my · um.edu.my/results");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Postgraduate programme acceptance letter (postgrad admission demo)
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "09_postgrad_offer_letter.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(16).text("UNIVERSITI MALAYA", { align: "center" });
    d.font("Helvetica").fontSize(10).text("Institute of Graduate Studies (IGS)", { align: "center" });
    d.moveDown(1.5);

    d.font("Helvetica").fontSize(10);
    d.text("Ref: IGS/PG/2026/MSCS-0772");
    d.text("Date: 8 April 2026");
    d.moveDown(1);

    d.text("Mr. Daniel Ahmad bin Iskandar");
    d.text("12, Jalan Setia Jaya 4,");
    d.text("Taman Setia, 47000 Sungai Buloh, Selangor");
    d.moveDown(1);

    d.font("Helvetica-Bold").fontSize(11).text("Conditional Offer of Admission — Master of Computer Science");
    d.moveDown(0.5);
    d.font("Helvetica").fontSize(10.5);

    d.text("Dear Mr. Daniel,");
    d.moveDown(0.5);
    d.text(
      "Following the assessment of your application (reference IGS-APP-2026-009811), it is my pleasure to extend a " +
      "CONDITIONAL OFFER for admission to the following programme:"
    );
    d.moveDown(0.3);
    d.text("Programme: Master of Computer Science (by Coursework)");
    d.text("Department: Faculty of Computer Science and Information Technology");
    d.text("Mode: Full-time");
    d.text("Intake: Session 2026/2027 — September 2026");
    d.text("Duration: 3 semesters (12 months) full-time");
    d.moveDown(0.6);

    d.font("Helvetica-Bold").text("Conditions of Offer:");
    d.font("Helvetica");
    d.text("1. Submission of your final undergraduate transcript with CGPA ≥ 3.00 (you currently report 3.45 — confirmation required).");
    d.text("2. Submission of an English-language proficiency certificate: IELTS ≥ 6.0 OR MUET Band 4+ OR equivalent.");
    d.text("3. Acceptance of these conditions and payment of the registration deposit (RM 500) by 30 June 2026.");
    d.moveDown(0.6);

    d.text(
      "Once all conditions are satisfied, this offer will be upgraded to UNCONDITIONAL and a formal admission letter " +
      "will be issued via the IGS portal for your registration on or before 31 August 2026."
    );
    d.moveDown(1);

    d.text("On behalf of the Institute, we extend our warm congratulations and look forward to welcoming you.");
    d.moveDown(1.5);

    d.font("Helvetica-Bold").text("Prof. Dr. Siti Aminah binti Hassan");
    d.font("Helvetica").text("Dean, Institute of Graduate Studies");
    d.text("Universiti Malaya · 50603 Kuala Lumpur");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. EMGS visa renewal — pass status notice (EMGS demo)
// ─────────────────────────────────────────────────────────────────────────────
docs.push({
  filename: "10_emgs_pass_status_notice.pdf",
  build: (d) => {
    d.font("Helvetica-Bold").fontSize(15).text("EDUCATION MALAYSIA GLOBAL SERVICES", { align: "center" });
    d.font("Helvetica").fontSize(10).text("EMGS — Pass Application Status Notice", { align: "center" });
    d.moveDown(1.5);

    d.font("Helvetica").fontSize(10);
    d.text("Application No: EMGS-RNW-2026-114455");
    d.text("Date Issued: 20 March 2026");
    d.moveDown(0.6);

    d.text("Applicant Name: Priya Devi a/p Raman");
    d.text("Passport No: A12345678 (India)");
    d.text("Date of Birth: 7 June 2001");
    d.text("Institution: Universiti Malaya");
    d.text("Programme: Bachelor of Engineering (Civil), Year 4");
    d.moveDown(0.8);

    d.font("Helvetica-Bold").fontSize(11).text("Current Pass Status");
    d.font("Helvetica").fontSize(10);
    d.text("Pass type: Student Pass (Visit Pass — Temporary Employment)");
    d.text("Pass expiry: 31 May 2026");
    d.text("Renewal application status: APPROVED (released 20 March 2026)");
    d.text("New pass validity: 1 June 2026 to 31 May 2027");
    d.moveDown(0.6);

    d.font("Helvetica-Bold").fontSize(11).text("Action Required by Student");
    d.font("Helvetica").fontSize(10);
    d.text("• Submit passport for visa endorsement at the EMGS Stickering Centre by 25 May 2026.");
    d.text("• Bring this notice and the original passport.");
    d.text("• No further payment due — fees were settled at application submission.");
    d.moveDown(1);

    d.fontSize(9).fillColor("#666");
    d.text("This is an official EMGS notice. Verify at portal.emgs.com.my with the application number above.");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Generate all docs
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  for (const spec of docs) {
    const outPath = path.join(OUT_DIR, spec.filename);
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: { Title: spec.filename, Author: "UniGuide demo data generator" },
    });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);
    spec.build(doc);
    doc.end();
    await new Promise<void>((resolve) => stream.on("finish", () => resolve()));
    console.log("✓", spec.filename, "→", outPath);
  }
}

main().catch((err) => {
  console.error("FAILED", err);
  process.exit(1);
});
