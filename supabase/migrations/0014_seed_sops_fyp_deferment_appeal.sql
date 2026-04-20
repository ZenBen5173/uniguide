-- Seed SOPs for FYP, Deferment, Exam Appeal so they appear as Live procedures.
-- Source markdowns committed at lib/kb/seed/.

delete from public.procedure_sop_chunks where procedure_id in ('final_year_project','deferment_of_studies','exam_result_appeal');

insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 0, null, 'Source: FSKTM Undergraduate Handbook 2026 · UM Bachelor''s Degree Regulations · Faculty FYP Coordinator office.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 1, 'Eligibility', 'A student is eligible to register for FYP I (WIA3001 / WIB3001) if **all** the following are true:

1. **Year of study** — must be in Semester 1 of Year 3 (or later).
2. **Credit hours** — must have completed at least 80 credit hours of core programme courses.
3. **CGPA** — must hold a CGPA of at least 2.00. Below 2.00 requires a written appeal endorsed by the academic adviser.
4. **Concurrent registration** — cannot be registered concurrently for Industrial Training. FYP I and Industrial Training compete for the same project semester.
5. **No outstanding F grades** — in any prerequisite course (Software Engineering, Database Systems, etc. depending on programme).

International students must additionally have valid EMGS visa coverage for the full FYP I + II duration (typically 2 semesters).');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 2, 'Project Categories', 'FYP at FSKTM is classified into 4 categories. Project category determines supervisor pool, required deliverables, and ethics review pathway.

1. **Research (R)** — academic research with a literature review, methodology, experimentation, results. Typically supervised by research-active staff.
2. **Application Development (AD)** — building a working software system. Most common category. Deliverable: working prototype + technical documentation.
3. **Industry-linked (IL)** — project sponsored or co-supervised by an external company. Requires a Letter of Industry Engagement signed by the company representative.
4. **Capstone (C)** — multi-disciplinary group projects, typically 3–4 students, integrating multiple subject areas.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 3, 'Supervisor Matching', 'Students must secure a supervisor **before** the FYP I add/drop deadline (typically Week 2). Supervisor matching workflow:

1. **Browse supervisor list** — published on the FSKTM intranet at the start of each project semester. Includes each supervisor''s research interests, current FYP load, and accepting status.
2. **Approach supervisors** — students email supervisors directly with a brief proposal (one paragraph: problem, why interesting, what you''d build/research). Most supervisors respond within 5 working days.
3. **Acceptance** — supervisor confirms via email or signs the FYP-1 form (Faculty form FSKTM/FYP/01).
4. **Capacity rule** — each supervisor can take a maximum of 5 FYP students per semester (Faculty Senate Decision 2024-12). If a supervisor''s quota is full, they must decline.
5. **No supervisor by Week 2 deadline** — student is auto-assigned by the FYP Coordinator based on remaining capacity. Topic may be dictated by available supervisor''s research area.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 4, 'Documents Required', 'For FYP I registration:

- **FYP-1 form** (Faculty form FSKTM/FYP/01) — signed by both student and accepted supervisor.
- **Project proposal** — 2-page document covering: problem statement, motivation, scope, expected deliverables, project plan with milestones.
- **Industry engagement letter** (Industry-linked category only) — signed by external company representative confirming sponsorship, scope, and IP arrangements.
- **Ethics declaration** — required if the project involves human subjects (user studies, surveys, interviews). Signed declaration triggers ethics committee review (4–8 weeks).
- **Capstone team form** (Capstone category only) — confirming all team members and their roles.

For FYP II registration (next semester):

- **FYP I final report** — submitted and graded.
- **FYP-2 form** — confirms continuation with the same supervisor and project.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 5, 'Ethics Review', 'Required when the project involves:

- **Human subjects** — interviews, surveys, observations, user testing
- **Personal data collection** — health, financial, identifying data
- **Vulnerable populations** — minors, patients, prisoners, students of the supervisor

Ethics review pathway:

1. Submit Ethics Declaration form to Faculty Ethics Committee
2. **Standard review** — 4 weeks turnaround
3. **Expedited review** — 2 weeks if low risk (e.g., anonymous survey of UM students)
4. **Full board review** — 6–8 weeks if medium-high risk (e.g., medical data, sensitive populations)

**No data collection may begin before ethics approval is granted.** Beginning early is grounds for project failure under University Research Ethics Code.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 6, 'Stages and Deadlines', '| Week | Milestone | Deliverable |
|---|---|---|
| Pre-Sem | Browse supervisor list, secure supervisor | FYP-1 form signed |
| Week 1–2 | Register FYP I via MAYA; submit proposal | Proposal accepted by supervisor |
| Week 4 | Ethics submission (if applicable) | Ethics declaration form |
| Week 8 | Mid-semester review | Progress report (5 pages) |
| Week 14 | Final FYP I submission | Final report (30–40 pages) + viva |');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 7, 'Common Pitfalls', '- **Late supervisor search** — students who wait until Week 2 often find every preferred supervisor at quota. Approach 2 weeks before semester starts.
- **Ethics oversight** — assuming "I''m just doing a quick survey" doesn''t need ethics. **Any human subject involvement requires ethics review**, no exceptions.
- **Industry letter delay** — Industry-linked projects fail registration because the company takes 2+ weeks to provide the letter. Start the letter request immediately upon company agreement.
- **Capstone team registration** — all team members must register simultaneously. Late registration of one member can void the entire team''s project.
- **F grade prerequisite** — if you have an F in Software Engineering and your project is application-development category, you must clear the F first or change category.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('final_year_project', 8, 'Failure & Re-registration', 'If a student fails FYP I:

- **Below 50%** — must re-register and re-do FYP I in the next available project semester.
- **Withdrew before Week 8** — counts as withdrawal, not failure; can re-register without penalty.
- **Withdrew after Week 8** — counts as failure; affects CGPA.

Re-registration counts as a course retake under University Bachelor''s Degree Regulations 2024.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 0, null, 'Source: UM Bachelor''s Degree Regulations 2024 (Reg. 41) · Postgraduate Regulations 2024 (Reg. 12) · UM HEPA HEPA-DEFER-01 form · Deputy Vice-Chancellor (Academic & International) Office.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 1, 'When Deferment Is Allowed', 'A student may apply for deferment of studies (locally referred to as "Cuti Bersebab" or "Deferment of Studies") for **one of these recognised reasons**:

1. **Medical** — serious illness, surgery, mental health, hospitalisation. **Must** be supported by a Medical Certificate from a **Government Hospital** (not private GPs).
2. **Compassionate** — death of immediate family member, serious family emergency, full-time caregiver responsibility.
3. **Financial** — provable financial hardship (income loss, parent retrenchment) that prevents continued study. Supporting documents: termination letter, EPF withdrawal evidence, B40 status documentation.
4. **National service** — students called up for national service (PLKN, ATM, RELA Border, etc.). Supporting document: official deployment letter from the relevant agency.
5. **Internship / industrial training** — only if the placement is not part of the academic programme and prevents normal attendance.
6. **Other** — e.g. competitive sports representing the country, religious obligations (Haj for Muslim students), maternity. Each reviewed case-by-case.

**Personal preference, financial planning, or "taking a gap year"** are NOT recognised reasons under Reg. 41.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 2, 'Maximum Duration', '| Programme level | Standard maximum | Total cumulative cap |
|---|---|---|
| Undergraduate | 1 academic year (2 semesters) | 4 semesters across the entire programme |
| Postgraduate (Master''s by coursework) | 1 semester | 2 semesters |
| Postgraduate (Master''s research / PhD) | 1 academic year | 4 semesters |

Beyond the cumulative cap, the student is auto-terminated under University Regulations and must reapply as a new candidate. Faculty Senate may grant exceptions for exceptional medical cases.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 3, 'Eligibility Constraints', 'A student may NOT apply for deferment if:

1. **Currently in their final semester** — must complete or withdraw, not defer.
2. **On academic probation** — must clear the probation by retaking failed courses, not defer.
3. **Visa-dependent international student** — deferment causes visa to lapse. Must coordinate with EMGS via HEPA International Office before applying.
4. **Recipient of a sponsored scholarship** — deferment may breach the scholarship contract; must obtain sponsor approval first.
5. **Within the first 2 weeks of a semester** — deferment in the first 2 weeks is treated as withdrawal, not deferment, and full course fees may be refunded.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 4, 'Documents Required', 'For ALL deferment applications:

- **HEPA-DEFER-01 form** — official deferment application form, downloaded from UM HEPA portal
- **Personal statement** — 1 page explaining the reason, intended return date, and what the student will do during the deferment
- **Proof document** matching the chosen reason:
  - **Medical:** MC from Government Hospital (Hospital Kuala Lumpur, UMMC, etc.). Private GP MCs are **rejected outright**.
  - **Compassionate:** death certificate, family member''s medical report, or police report (depending on the situation)
  - **Financial:** parent termination letter, EPF withdrawal statement, B40 verification letter
  - **National service:** official deployment letter from PLKN/ATM/RELA
  - **Sport/religious:** confirmation letter from the relevant body (NSC, Tabung Haji, etc.)
- **Sponsor consent letter** (only if scholarship recipient) — signed by scholarship sponsor confirming approval

For international students additionally:

- **EMGS coordination letter** from HEPA International Office acknowledging the visa implication
- **Updated visa plan** showing how the visa will be maintained or renewed during deferment');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 5, 'Stages and Approval Pathway', '```
Student → Faculty (Programme Coordinator) → Dean → DVC (Academic & International)
```

1. **Submit application** to Faculty Programme Coordinator (Week 1–4 of the semester to be deferred)
2. **Programme Coordinator review** — verifies documents complete, reason matches one of the 6 recognised categories. **Turnaround: 5 working days.**
3. **Dean''s endorsement** — Faculty Dean reviews academic standing, signs off. **Turnaround: 7 working days.**
4. **DVC final approval** — Deputy Vice-Chancellor (Academic & International) issues the deferment letter. **Turnaround: 14 working days.**
5. **Student receives deferment letter** — confirms deferment period, return semester, and any conditions

Total expected timeline: **3–4 weeks from submission to approved letter**. Apply early in the semester to be deferred — last-minute applications often miss the Week 4 cutoff.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 6, 'Common Pitfalls', '- **Private clinic MC** — **rejected, no exceptions.** Get the MC from a Government Hospital. UMMC counts.
- **Late application** (Week 5+) — often refused. Once tuition fees are due, deferment becomes withdrawal-with-penalty.
- **No personal statement** — incomplete application; sent back without progressing.
- **International student forgets EMGS coordination** — visa lapses during deferment, return blocked.
- **Sponsor not consulted** — scholarship contract breach can trigger fee clawback.
- **Cumulative cap exceeded** — fourth deferment for an undergraduate triggers auto-termination, even if Faculty would otherwise approve.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('deferment_of_studies', 7, 'Return from Deferment', 'To return:

1. **Notify Programme Coordinator** at least 4 weeks before the start of the return semester
2. **Re-register** for courses via MAYA during normal registration window
3. **Updated medical clearance** (Medical category only) — confirming fitness to resume studies
4. **EMGS visa renewal** (international students) — must be in place before return semester starts

If the student does not return by the agreed semester without applying for an extension, they are **deemed to have withdrawn** and must reapply as a new candidate.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 0, null, 'Source: UM Bachelor''s Degree Regulations 2024 (Reg. 40 — Grade Review) · Examinations & Graduation Section, Academic Administration Division (`aasd.um.edu.my`).');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 1, 'Three Appeal Routes — Pick One', 'UM''s regulations distinguish three different appeal routes. Picking the wrong one is the most common mistake — students burn the 2-week window filing under the wrong regulation.

### Reg. 40 — Grade Review (most common)

For: Disputing the **grade** itself for one or more courses (you believe the grade is wrong, marking error, missed component).

- **Window:** 2 weeks from the official result release date on MAYA
- **Fee:** RM 50 per course, non-refundable, payable via MAYA before submission
- **Outcome:** grade may be raised, lowered, or unchanged
- **No further appeal** — Reg. 40 review is final

### Reg. 41 — Extension of Programme Duration

For: Requesting **more semesters** to complete your programme (you''ve used your maximum allowed semesters and need an extension).

- **Window:** Anytime, ideally before the maximum-duration deadline lapses
- **Fee:** None (Senate decision)
- **Outcome:** 1–2 additional semesters granted, with conditions
- **Approval body:** Faculty Senate via Dean

### Reg. 42 — Continue After Termination

For: Resuming your programme after **academic termination** (CGPA < 2.00 for two consecutive semesters, etc.).

- **Window:** Within 30 days of receiving termination letter
- **Fee:** RM 100 administrative fee
- **Outcome:** Senate may grant continuation under probation conditions, or uphold termination
- **Approval body:** University Senate');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 2, 'Eligibility — Reg. 40 Specifically', 'A grade review appeal under Reg. 40 is allowed if:

1. **Within 2 weeks** of the official result release date (check MAYA for the exact date)
2. The course was **taken during the immediately preceding semester** (not earlier semesters)
3. The student **paid the appeal fee** (RM 50 per course) before submitting
4. The appeal raises a **specific concern** — not a general "I think I deserve better"

Acceptable specific concerns:

- Marking error you can identify (e.g., "Final exam Q3 should have given 8 marks not 4")
- Component missing from total (e.g., assignment not graded)
- Inconsistency between answer scheme and your answer
- Compassionate circumstance during the exam (illness, family emergency) supported by evidence

NOT acceptable:

- "My friend got higher marks for similar answer" (without specific identification of the marking inconsistency)
- "I worked very hard" (effort is not graded — outcome is)
- "The lecturer doesn''t like me" (without procedural evidence)');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 3, 'Documents Required', 'For Reg. 40:

- **Appeal form** (Form AAD/EXM/REVIEW-01) — downloaded from `aasd.um.edu.my`
- **Payment proof** — RM 50 per course, paid via MAYA student portal
- **Specific complaint statement** — 1 page identifying the specific marking issue with reference to the exam paper (question number, expected vs actual mark)
- **Supporting evidence** (if compassionate) — Medical Certificate (Government Hospital), police report, etc.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 4, 'Stages and Timeline (Reg. 40)', '```
Week 0 (Result Release Day)
  ↓
Within 2 weeks: Submit appeal + payment
  ↓
Week 3–4: Faculty receives review request, examiner re-marks
  ↓
Week 4–6: Re-marking outcome, second examiner if needed
  ↓
Week 6–8: Result confirmed by Faculty, communicated to student via MAYA
```

Total: **6–8 weeks** from result release to final outcome.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 5, 'Common Pitfalls', '- **Picked Reg. 41 when meant Reg. 40** — extension vs grade review are different. If unsure: did you fail the course, or is your CGPA < 2.00? If neither, you want **Reg. 40 grade review**.
- **Missed the 2-week window** — the system **does not accept late submissions**. Set a calendar reminder the day results release.
- **Vague complaint** — "I think the grade is wrong" gets dismissed. Be specific: cite the question number, your answer, and why your answer should have scored higher than awarded.
- **Forgot the fee** — appeal not processed without payment.
- **Multiple courses** — pay RM 50 PER COURSE; one fee doesn''t cover all.
- **Already passed** — if you got a B and want an A: yes, allowed under Reg. 40. Pay the fee and submit.
- **Result might be lowered** — re-marking can result in a **lower grade**, not just higher. Choose battles wisely.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 6, 'Special Cases', '- **Compassionate appeals** (illness during exam) — better filed via Reg. 40 with full medical documentation than via Reg. 41 (extension). The grade review can result in a deferred sit at the next exam if approved.
- **Lost answer script / examiner administrative error** — file under Reg. 40 with a note that the issue is administrative, not academic. Fee waiver possible if Faculty confirms administrative error.
- **Multiple courses contested** — submit one appeal form per course. Each is reviewed independently.
- **CGPA implications** — if a successful Reg. 40 review changes a grade from F to C, your overall CGPA recalculates and any academic-probation status may lift retroactively.');
insert into public.procedure_sop_chunks (procedure_id, chunk_order, section, content) values ('exam_result_appeal', 7, 'Outcomes and Communication', 'After Faculty review:

| Outcome | What it means |
|---|---|
| **Grade raised** | New grade replaces old; transcript updated within 1 week |
| **Grade unchanged** | Original grade stands; appeal fee not refunded |
| **Grade lowered** | Re-marking found a higher original error; new (lower) grade applies |
| **Re-sit granted** | (Compassionate cases only) student takes a deferred exam at next sitting |

Outcome is communicated via MAYA inbox with a downloadable Faculty letter. No further appeal under Reg. 40 — the result is final.');