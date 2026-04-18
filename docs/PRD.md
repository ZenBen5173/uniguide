# PRODUCT REQUIREMENT DOCUMENT (PRD)

**Project Name:** UniGuide
**Version:** 1.0
**Domain:** AI Systems & Agentic Workflow Automation (Domain 1)
**Team:** Breaking Bank
**Submission:** UMHackathon 2026 — Preliminary Round
**Date:** 18 April 2026

---

## Table of Contents

1. Project Overview
2. Background & Business Objective
3. Product Purpose
4. System Functionalities
5. User Stories & Use Cases
6. Features Included (Scope Definition)
7. Features Not Included (Scope Control)
8. Assumptions & Constraints
9. Risks & Questions Throughout Development

---

## 1. Project Overview

### Problem Statement
Every Malaysian university student is, sooner or later, blocked by the same kind of wall: an opaque multi-stage administrative procedure that no one has fully explained. Scholarship and financial aid applications, postgraduate admissions, examination appeals, deferment of studies, FYP supervisor matching, EMGS visa renewals — each procedure spans 6 to 12 stages, involves 3 to 5 different offices, references regulations buried in PDFs, and has silent failure modes (a missed two-week appeal window, a private-clinic medical certificate that needed to be from a Government Hospital, a CGPA that's 0.20 short of an unwritten threshold, applying to MARA without realising it's Bumiputera-only). Today, students piece these procedures together from outdated forum threads, faculty WhatsApp groups, and trial-and-error emails. Administrators on the receiving end then spend hours triaging incomplete, mis-routed submissions.

### Target Domain
University administrative procedures at Universiti Malaya — guiding students through complex multi-step processes with adaptive decision-making, while pre-digesting their submissions for the staff who must approve them.

### Proposed Solution Summary
**UniGuide** is an AI-driven workflow assistant where Z.AI's GLM acts as the central reasoning engine that (a) reads the official UM Standard Operating Procedure for whatever the student is trying to do, (b) plans a personalised step-by-step workflow rendered as a visual canvas, (c) walks the student through it adaptively — rewording questions for their context, parsing uploaded documents, asking clarifying questions when answers are ambiguous, routing them down the right branch at every decision point, and (d) hands them a packet of structured deliverables at the end (filled official forms, draft emails to the right offices, an `.ics` deadline calendar, a checklist of physical things still to do). On the other side, administrators receive a GLM-prepared briefing for each submission — extracted facts, flagged edge cases, recommended decision with reasoning trace — so they can approve or reject in a single click instead of re-reading the same incomplete form for the hundredth time.

If the GLM component is removed, UniGuide collapses to a static form filler. There is no pre-coded routing logic for any individual procedure: every workflow is **planned at runtime by GLM** from the underlying SOP knowledge base, and every decision node is **resolved at runtime by GLM** reading the actual response.

---

## 2. Background & Business Objective

### Background of the Problem
University procedures at UM are documented in three principal corpora — the Bachelor's Degree Regulations (a 100+ page legal document), faculty-specific handbooks (a different one for every faculty and every cohort), and ad-hoc PDF forms scattered across `um.edu.my` subdomains (`hep.um.edu.my`, `fsktm.um.edu.my`, `ips.um.edu.my`, `study.um.edu.my`, `aasd.um.edu.my`). Three principal authorities own the decisions — the Faculty Dean (operational), the Deputy Vice-Chancellor Academic & International (escalation), and the Senate (final academic). Three principal student-facing portals expose the workflows — MAYA (academic portal), SiswaMail (notifications), SPeCTRUM (LMS). None of these systems share a single source of truth for "what is the status of my application?" Students spend hours assembling a mental model that the institution has never bothered to write down in one place.

### Importance of Solving This Issue
- **Student welfare:** an estimated thousands of UM students per year miss critical deadlines (exam appeal: 2 weeks; EMGS visa renewal: 3 months in advance; corporate scholarships: narrow Feb–April window) or apply to scholarships they don't qualify for, simply because the eligibility rules were never explained to them in one place.
- **Administrative cost:** every incomplete or mis-routed submission consumes minutes of staff time. At scale (Yayasan UM alone receives thousands of applications per year, many auto-rejected for ineligibility), this is hundreds of staff-hours that could be returned to actual review of viable candidates.
- **Compliance & audit:** the absence of a structured paper trail makes it difficult for the university to audit consistency across faculties (do all faculties endorse Yayasan UM applications consistently? does the CGPA-hardship trade-off get applied uniformly?).

### Strategic Fit / Impact
- Aligns with UM's digitalisation roadmap and the Ministry of Education's push toward standardised student services.
- Demonstrates **Z.AI GLM** as a load-bearing reasoning engine for a real-world Malaysian use case, not a generic chatbot wrapper.
- Mirrors the architectural pattern (workflow engine + canvas + atomic stage advancement) that production workflow tools have validated, but raises the abstraction level: instead of human-designed templates, GLM designs the templates at runtime.

---

## 3. Product Purpose

### 3.1 Main Goal of the System
To provide every UM student with a personalised, adaptive AI guide for any administrative procedure — from intent expression to filed paperwork — and to give every UM administrator a pre-digested submission briefing instead of a raw form to triage.

### 3.2 Intended Users (Target Audience)

**Primary user group — Students:**
- Undergraduate students (scholarships, FYP, exam appeals, deferment)
- Postgraduate candidates (admission, supervisor matching, thesis submission)
- International students (EMGS visa renewal, additional MoE compliance)

**Secondary user group — Staff:**
- Yayasan UM / Scholarship Office officers
- Faculty Postgraduate Committee members
- Faculty Deans and Deputy Deans (Academic)
- Examination & Graduation Section officers
- Academic Administration Division officers

**Tertiary stakeholders (not direct users in MVP, considered in design):**
- Deputy Vice-Chancellor Academic & International (escalation tier)
- Heads of Department, FYP Coordinators, Supervisors
- HEPA officers (international students, deferment-linked records)

---

## 4. System Functionalities

### 4.1 Description
UniGuide is a stateful, adaptive workflow engine powered by Z.AI's GLM. The system accepts unstructured natural-language intent from a student ("I want to apply for industrial training next semester"), retrieves relevant SOP content from a vector-indexed knowledge base of UM regulations and forms, and uses GLM to plan a personalised workflow rendered on a ReactFlow canvas. As the student progresses through the workflow, GLM continuously adapts — rewriting questions, parsing uploaded documents into structured fields, deciding the next branch at decision nodes by reasoning over the actual response content (not regex matches), and emitting structured artefacts (filled PDFs, draft emails, calendar files) at the end. Administrators receive a separate dashboard view where each pending submission is presented as a GLM-generated briefing with extracted facts, flagged edge cases, and a recommended decision plus reasoning trace.

### 4.2 Key Functionalities

| # | Functionality | Description |
|---|---|---|
| F1 | **Conversational Intent Intake** | Student types or speaks a free-form description of what they need. GLM extracts the intent, identifies the candidate procedure(s), and asks 2–3 disambiguating questions if needed (faculty? year of study? domestic/international?). |
| F2 | **GLM Workflow Planner** | Given a confirmed procedure and the student's profile/context, GLM reads the procedure SOP from the knowledge base and emits a structured workflow JSON (stages, steps, decision branches, deadlines). The JSON is rendered immediately on a ReactFlow canvas so the student sees the road ahead. |
| F3 | **Adaptive Step Engine** | At each step, GLM (a) rewords the question for the student's specific context, (b) skips fields that don't apply, (c) pre-fills from prior answers, (d) accepts document uploads (PDF/image) and extracts structured fields via parsing, (e) flags inconsistencies in real time. |
| F4 | **AI-Reasoned Decision Routing** | At each decision node, GLM evaluates the response content (free-text, uploaded document, form data) against the branch criteria and selects the next stage. Every decision is logged with a confidence score and natural-language reasoning trace. |
| F5 | **Tool-Augmented Reasoning** | GLM has access to a defined tool surface: `lookup_procedure(name)`, `get_student_profile()`, `parse_document(file)`, `lookup_regulation(reference)`, `draft_email(recipient, context)`, `generate_form(template_id, data)`, `add_calendar_event(deadline)`. Tools are called as needed during reasoning. |
| F6 | **Structured Output Generation** | At workflow completion (or any sub-stage), GLM emits: (a) filled official PDF forms (e.g., UM-PT01-PK01-BR074-S00), (b) draft emails to relevant offices, (c) `.ics` calendar with all deadlines, (d) a remaining-actions checklist. |
| F7 | **Administrator Briefing Dashboard** | Staff see a queue of pending submissions. Each submission expands to a GLM-prepared briefing: extracted facts, flagged edge cases, recommended decision with reasoning, and one-click Approve / Reject / Request More Info. |
| F8 | **Failure Recovery & Escalation** | If a stage stalls (e.g., coordinator hasn't responded within SLA), GLM proposes recovery actions — drafts chase emails, suggests escalation to the next authority, opens a parallel sub-flow. |
| F9 | **Audit & Reasoning Trace** | Every GLM decision (planning, question rewriting, routing, recommendation) is persisted with model version, prompt hash, response, confidence, and any tool calls. Queryable per task and per user. |

### 4.3 AI Model & Prompt Design

#### 4.3.1 Model Selection
**Selected model: Z.AI GLM (`glm-4.6` for primary reasoning; `glm-4.5-flash` for lightweight tasks like intent classification and form-field rewording).**

Justification:
- **Mandatory by hackathon rules** — the Judging Criteria explicitly state that using any other reasoning model is grounds for disqualification.
- **Long context window** (sufficient to fit a full UM procedure SOP plus the student's accumulated responses in a single call without aggressive chunking) — critical for our multi-step reasoning.
- **Tool-calling support** — GLM's function-calling interface allows us to expose our tool surface (document parsing, form generation, calendar emit) cleanly without prompt-engineering tool calls into free-text responses.
- **Structured output (JSON mode)** — needed for the workflow-planner and decision-routing endpoints, which must return parseable JSON 100% of the time.
- **Reasoning model variant available** — for the decision-routing endpoint where cost-per-call is acceptable but correctness must be maximised, we use the reasoning variant; for high-throughput intent extraction we use the flash variant.

#### 4.3.2 Prompting Strategy
We employ **multi-step agentic prompting with role-specialised system prompts**. Each GLM-powered endpoint has a dedicated system prompt and tool surface:

| Endpoint | Strategy | Reason |
|---|---|---|
| Intent Extraction | Zero-shot, JSON-mode, `glm-4.5-flash` | High volume, low complexity, cost-sensitive |
| Workflow Planner | Few-shot (3 reference SOPs in prompt), JSON-mode, full `glm-4.6` | Plan correctness is foundation of everything downstream |
| Step Adapter | Zero-shot with retrieved context | Per-step rewording is small, frequent, low-stakes |
| Decision Router | Chain-of-thought + JSON-mode + confidence score | Routing errors are user-visible; reasoning trace is required for audit |
| Document Parser | Zero-shot with structured-extraction schema | One-shot parsing per document |
| Admin Briefing | Few-shot with sample briefings, structured JSON | Consistent format across submissions |

**Prompt-caching strategy:** procedure SOPs and few-shot examples are static; we cache them at the prompt-prefix level (using GLM's prompt caching where available) so each call only pays for the dynamic suffix. Estimated hit rate: ~70% for intent + planner, ~90% for step adapter.

#### 4.3.3 Context & Input Handling
- **Maximum text input per call:** 32,000 tokens (well within GLM's window). Beyond this, we chunk by procedure-section.
- **Maximum document upload:** 10 MB per file, 5 files per workflow. PDFs and images (JPG/PNG) only.
- **Document-to-text:** PDFs are extracted via `pdf-parse`; images go through OCR (Tesseract.js) before being included as text in the GLM context.
- **If input exceeds limits:**
  - Text: rejected with a user-facing message ("Please summarise to under 5,000 words.").
  - Document: rejected with size limit error and option to upload a smaller file or split.
  - Per-conversation history: we keep the last 20 turns verbatim and summarise older turns into a running "context summary" that occupies <500 tokens.

#### 4.3.4 Fallback & Failure Behavior
- **Off-topic response:** detected via output schema validation (workflow planner, decision router, document parser all return JSON conforming to a Zod schema). Schema violation triggers one automatic retry with a corrective system prompt; second failure escalates to a graceful error state ("I couldn't process this — try rephrasing or contact support").
- **Hallucinated facts (e.g., GLM fabricates a regulation reference):** the decision router and admin-briefing endpoints are constrained to **only cite regulations that exist in the indexed knowledge base** — citations are validated against the KB before being shown to the user.
- **GLM API timeout (>10s):** retry once with exponential backoff; on second failure, surface a "service is slow, please retry" toast and persist the partial state.
- **GLM API rate limit:** implement Upstash-Redis-backed rate limiting per user (10 calls/min) to stay under the platform quota, with a queue for non-urgent calls (admin briefings).
- **GLM API down:** if the planner endpoint fails, the system **explicitly cannot proceed** — we do not silently fall back to a static template. The user sees "AI planner is currently unavailable; we cannot plan your workflow without it" with an estimated retry time. This satisfies the hackathon requirement that removing GLM breaks the system.
- **Human escalation path:** every workflow has a "talk to a human" button that creates a pending support task visible in the admin dashboard with the full conversation transcript pre-attached.

---

## 5. User Stories & Use Cases

### User Stories

**As an undergraduate student**, I want to type "I need a scholarship, my family income is RM3500, my CGPA is 3.10" and have the system tell me which scholarships I'm eligible for, walk me through the right application, and warn me when my CGPA is below threshold so I can prepare a hardship justification — instead of bulk-applying to everything and getting auto-rejected.

**As an international postgraduate student**, I want one place to manage my visa renewal alongside my faculty paperwork — so that I don't miss the EMGS 3-month buffer because I was focused on my thesis defence.

**As a final-year student appealing an exam result**, I want the system to tell me which of the three appeal routes (Reg.40 grade review, Reg.41 extend duration, Reg.42 continue after termination) actually applies to my case — so that I don't burn the 2-week deadline filing the wrong form.

**As a Yayasan UM scholarship officer**, I want each application to arrive with the CGPA verified, the income tier inferred from the parsed EPF/payslip, the Bumiputera status confirmed, and any CGPA shortfall flagged with the student's hardship justification surfaced — so that I can approve standard B40 cases in seconds and focus my time on the borderline ones that need judgement.

**As a Faculty Dean**, I want to audit the consistency of decisions across coordinators in my faculty — so that I can catch unwritten variation in how regulations are applied.

### Use Cases (Main Interactions)

**UC-1 — Intent to Workflow Plan (Student)**
1. Student opens UniGuide, types or speaks a free-form intent.
2. GLM extracts the candidate procedure and confidence score.
3. If confidence < 0.8, GLM asks 1–3 disambiguating questions.
4. GLM retrieves the procedure SOP from the knowledge base.
5. GLM emits a workflow JSON (stages, steps, edges, deadlines, decision points).
6. The system renders the workflow on a ReactFlow canvas; the student sees the full road map.

**UC-2 — Adaptive Step Execution (Student)**
1. Student clicks the active stage on the canvas.
2. GLM presents the next step with context-rewritten question text.
3. Student responds (text, file upload, or selection).
4. If file upload: GLM parses, extracts fields, pre-fills the form, asks for confirmation.
5. GLM validates the response against expected schema.
6. The system advances stage progress; canvas updates.

**UC-3 — Decision Node Resolution (Student / GLM)**
1. Workflow reaches a decision node (e.g., "Income tier branch — need-based eligible vs merit-only").
2. GLM reads the relevant prior responses (form fields, uploaded EPF / payslip, free-text Q&A).
3. GLM emits a structured decision: `{ branch: "need_based_eligible", confidence: 0.94, reasoning: "Student declared family income of RM 3,500/month, within the B40 band per DOSM 2026 brackets. Eligible for Yayasan UM and JPA need-based scholarships.", citations: ["UM HEPA Scholarship Guidelines", "DOSM Income Classification 2026"] }`.
4. The system follows the decision branch; if confidence < 0.7, the system asks the student to confirm.

**UC-4 — Submission to Administrator Briefing (Cross-actor)**
1. Student completes the workflow and submits.
2. GLM generates an admin briefing: extracted facts, flagged edge cases, recommended decision, reasoning trace.
3. Briefing arrives in the Coordinator's queue.
4. Coordinator reviews (briefing + raw artefacts), clicks Approve / Reject / Request More Info.
5. Decision flows back to the student's workflow state; canvas updates; student is notified.

**UC-5 — Failure Recovery (Cross-actor)**
1. A stage exceeds its SLA (e.g., coordinator hasn't responded in 48 hours).
2. GLM proposes recovery actions: draft chase email, suggest escalation contact, open parallel sub-flow.
3. Student picks an action; GLM executes (sends draft, opens new branch).

### Use Case Diagram (textual)
```
          ┌─────────────────────────┐
          │       Student           │
          └──┬──────────┬───────────┘
             │          │
          UC-1        UC-2 ──── UC-3 ──── UC-5
             │                            │
             ▼                            │
    ┌────────────────────┐                │
    │   GLM Workflow     │                │
    │   Engine (core)    │◄───────────────┘
    └────────┬───────────┘
             │ UC-4
             ▼
    ┌────────────────────┐
    │   Administrator    │
    │   (Coordinator,    │
    │    Dean, etc.)     │
    └────────────────────┘
```

---

## 6. Features Included (Scope Definition — MVP)

**Core demo flow — Scholarship & Financial Aid Application (Yayasan UM pathway)** — implemented end-to-end with all branches:
- F1 Conversational intent intake
- F2 GLM workflow planner with ReactFlow canvas rendering
- F3 Adaptive step engine (rewording, document parsing, pre-fill)
- F4 AI-reasoned decision routing with confidence scoring
- F5 Tool-augmented reasoning (≥5 tools wired)
- F6 Structured output generation (PDF form, email drafts, `.ics`, checklist)
- F7 Administrator briefing dashboard (single coordinator role)
- F8 Failure recovery (chase-email drafting, escalation suggestion)
- F9 Audit trail with reasoning trace per decision

**Secondary procedure — Postgraduate Admission (research mode, IPS)** — implemented partially:
- Workflow planner + adaptive steps + at least one international/EMGS sub-flow demonstrating the engine's generalisation across procedures.

**Knowledge base seed:** indexed SOPs for the primary procedure (Scholarship Application) and Postgraduate Admission. The catalogue also lists FYP, Deferment, Exam Appeal, and EMGS Visa as procedures the engine generalises to (UI surfaces all six, but only Scholarship + Postgrad are interactive in the prototype).

**UI scope:** student-side single-page app with chat intake + canvas view + step pane; admin-side single dashboard with submission queue + briefing detail.

---

## 7. Features Not Included (Scope Control — Cut for MVP)

- **Multi-tenancy.** Single UM workspace; no per-faculty or per-university isolation.
- **Authentication beyond a stub login.** No SSO, no MAYA integration, no role hierarchy beyond `student` and `coordinator`.
- **Real integrations with UM systems.** No live MAYA, SiswaMail, SPeCTRUM, or EMGS API calls — these are mocked or stubbed with realistic sample data.
- **Email sending.** We generate draft emails as text; we do not send them via SMTP.
- **Payment processing.** Exam appeal fees and EMGS fees are mentioned in the workflow but no payment gateway is integrated.
- **Mobile native apps.** Web-responsive only.
- **Voice input.** Text input in MVP; voice is a stretch goal.
- **Multi-language UI.** English only (procedures themselves may include Bahasa Melayu document names).
- **Real-time collaborative editing.** Single-user-at-a-time per workflow.
- **Workflow versioning, template authoring UI.** All workflows are GLM-planned at runtime; there is no human template-builder.
- **Push notifications, mobile alerts.** In-app notification list only.
- **Coordinator-side analytics dashboard.** Single submission-queue view; no aggregate metrics.

---

## 8. Assumptions & Constraints

### LLM Cost Constraint
**Token budget per average user session:** target ≤ 60,000 tokens (input+output) for a complete Scholarship Application workflow. Estimated cost at GLM list pricing: under RM 0.50 per completed workflow. Design decisions to hold the budget:
- **Prompt caching** for procedure SOPs and few-shot examples (~70% of input tokens cached, target hit rate ≥60%).
- **Model tiering** — `glm-4.5-flash` for high-volume low-stakes calls (intent extraction, step adapter), `glm-4.6` only for planner and decision router.
- **Response-length caps** — JSON schemas constrain output length; free-text responses capped at 500 tokens.
- **Conversation summarisation** — turns older than 20 are summarised into a running 500-token rolling summary instead of replayed verbatim.
- **Tool-call short-circuit** — repeated identical tool calls (e.g., `lookup_procedure("scholarship_application")`) are memoised within a session.

### Technical Constraints
- **GLM API only.** Per Judging Criteria, no fallback to other LLMs even if GLM is unavailable. Failure mode is graceful degradation, not silent substitution.
- **Document parsing.** PDFs only via `pdf-parse`; OCR for images via Tesseract.js. Scanned PDFs without embedded text are routed through OCR with a quality warning.
- **Browser support.** Last 2 versions of Chrome, Firefox, Safari, Edge. No IE11.
- **Data persistence.** Supabase PostgreSQL with pgvector for KB retrieval. No on-prem deployment in MVP.

### Performance Constraints
- **GLM call latency target:** p95 < 4 seconds for planner and decision-router endpoints; p95 < 1.5 seconds for step adapter (flash model).
- **End-to-end "intent to canvas rendered" target:** p95 < 6 seconds.
- **Document parsing:** p95 < 10 seconds for a 5-page PDF.
- **Concurrent users (MVP):** designed for ≤ 50 concurrent active workflows. Beyond this, planner endpoint queues calls.

### User Input Constraints
- **Must be authenticated.** Anonymous sessions create demo-only workflows that are wiped after 24 hours.
- **Free-text input length.** Single message capped at 4,000 characters.
- **Document uploads.** Max 10 MB per file, max 5 files per workflow.
- **Profile prerequisites.** Student profile (faculty, year, programme, CGPA) must be completed before the planner runs — without it, the planner cannot resolve faculty-specific branches.

---

## 9. Risks & Questions Throughout Development

| # | Risk / Open Question | Why It Matters | Current Mitigation Plan |
|---|---|---|---|
| R1 | **GLM hallucinates a regulation reference that doesn't exist.** | Students could file the wrong appeal under a fabricated regulation number. | All citation outputs are validated against the indexed KB before shown to user; schema rejects unverifiable citations. |
| R2 | **Workflow planner generates an invalid workflow JSON** (cycle, dead-end stage, missing decision-node config). | Renders broken canvas; user is stuck. | Zod schema validation on planner output + automatic retry with corrective prompt; fallback to a "I couldn't generate a clean plan; here's what I tried" debug view. |
| R3 | **Decision router routes incorrectly under ambiguous input.** | User goes down the wrong branch, wastes time, may miss real deadlines. | Confidence threshold (≥0.7) for auto-routing; below threshold, GLM asks the student to confirm before advancing. |
| R4 | **GLM API outage during the live demo.** | Demo dies on stage. | Pre-recorded demo backup video; deterministic seed responses for the rehearsed demo flow stored in a fixture cache. |
| R5 | **Procedure SOPs change between research date (Apr 2026) and submission.** | Workflow advice could be slightly out of date. | Knowledge base is versioned and easily re-indexed; we cite the SOP source URL with the retrieval date in every reasoning trace. |
| R6 | **Student profile data is fabricated for the demo.** | Judges might ask "what about real student data?" | We document the integration surface for MAYA (read-only profile API) as a clear boundary; mock data is realistic and clearly labelled. |
| R7 | **Token cost overrun during demo / preliminary judging period.** | Burn through GLM credit before final round. | Per-user rate limit (10 calls/min), per-day quota (500 calls/team), prompt caching, model tiering. |
| R8 | **Cross-scholarship variation in unwritten rules** (e.g., income proof formats accepted by Yayasan UM vs MARA). | Single global SOP can't capture every scheme-specific carve-out. | KB is structured per-scholarship where variation is known; planner explicitly states "Based on Yayasan UM rules — confirm with the specific scholarship office if different." |
| R9 | **Admin reviewer over-trusts GLM recommendation.** | Approval becomes rubber-stamp; GLM mistakes propagate. | Briefing UI shows reasoning trace alongside recommendation; "Approve" requires reading the briefing; high-stakes decisions (rejection, escalation) require typed confirmation. |
| R10 | **Document parsing fails silently** (image OCR returns garbage). | Extracted fields are wrong; downstream decisions corrupted. | OCR confidence scores are surfaced; below threshold the user is asked to re-upload or transcribe manually. |

### Open Questions for Validation
- Will UM faculty staff actually use a third-party tool, or do procedures need to live inside MAYA? (Assumption for MVP: standalone, with a clear MAYA-integration boundary documented.)
- What's the right legal posture for hosting student data outside UM infrastructure? (Out of scope for hackathon; flagged for production roadmap.)
- Is there appetite for the system to auto-submit on the student's behalf (e.g., emailing the coordinator directly), or should it always remain advisory? (MVP: always advisory — humans send their own emails.)

---

**End of PRD v1.0**
