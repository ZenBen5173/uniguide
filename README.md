# UniGuide

**AI-driven workflow assistant for university administrative procedures.**
Built for **UMHackathon 2026**, Domain 1 — AI Systems & Agentic Workflow Automation.

UniGuide reads a student's free-text intent, plans a personalised workflow from the official UM SOP using **Z.AI's GLM**, walks the student through it adaptively, and pre-digests submissions for staff. Pull GLM out and the app collapses to a static form filler — that's the design.

📚 Hackathon documents:
- [docs/PRD.md](docs/PRD.md) — Product Requirement Document
- [docs/SAD.md](docs/SAD.md) — System Analysis Documentation
- [docs/QATD.md](docs/QATD.md) — QA Testing Documentation
- [docs/PITCH_DECK.md](docs/PITCH_DECK.md) — Pitch deck outline

---

## ⚡ Quick start (for teammates)

### Prerequisites
- Node.js 20+ and npm 10+
- Supabase account (free tier is fine) — for Postgres + auth + storage
- Z.AI account with GLM API key — get one at https://z.ai → API Platform
  - **Optional for early dev:** the GLM client has a `mock` mode that returns canned fixtures from `tests/fixtures/glm/` so the app runs without a live key.

### 1 — Install
```bash
npm install
```

### 2 — Configure environment
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `ZAI_API_KEY` (or leave blank + set `GLM_MOCK_MODE=true` for offline dev)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard → Project Settings → API)

### 3 — Set up the database
Apply the migrations to your Supabase project. From the Supabase dashboard:
- SQL Editor → paste the contents of `supabase/migrations/0001_initial_schema.sql` → run.
- Same for `0002_pgvector_kb.sql`, `0003_rls_policies.sql`, `0004_seed_procedures.sql`.

(Or use the Supabase CLI: `npx supabase db push` if you've linked the project.)

### 4 — Seed the knowledge base
```bash
npm run seed:kb
```
This reads each `lib/kb/seed/*.md` file, splits into chunks, and writes to `procedure_sop_chunks`. Re-run any time you edit the seed markdown.

### 5 — Run the dev server
```bash
npm run dev
```
Open http://localhost:3000.

---

## 🎬 Demo flow

1. **Open the landing page** — http://localhost:3000
2. **Click "Start a workflow"** or **Sign in** → use the Demo Student button on `/login` for instant access
3. **Type:** *"i need a scholarship for next sem, my family income is around RM3500, my cgpa is 3.10"*
4. **Click Continue.** GLM extracts the intent (`scholarship_application`), creates a workflow row, and generates a personalised workflow plan. You're redirected to the canvas view.
5. **Watch the canvas render** — stages, the income-tier decision node, two end nodes (Awarded vs Merit-only Corporate Path).
6. **Click through the steps** — confirm CGPA + income, choose scholarships, upload (mock) income proof + transcript, write motivation letter.
7. **At the income-tier decision node**, GLM auto-routes B40/M40 students to the need-based path; T20 students to the merit path.
8. **Workflow auto-submits** when it reaches the Faculty Endorsement stage. A briefing appears in the coordinator queue.
9. **Open the coordinator dashboard** — http://localhost:3000/coordinator/dashboard — to see the GLM-prepared briefing with extracted facts, flags, and recommendation.
10. **Click Approve.** The student's workflow advances to Yayasan UM Committee Review; another approval there marks it Awarded.

> 💡 **Mock mode demo:** the canned fixtures support the Yayasan UM scholarship golden path end-to-end without any real GLM calls. Set `GLM_MOCK_MODE=true` in `.env`.

---

## 🏗️ Architecture (TL;DR)

```
Browser (Next.js SPA)
  ├─ /student/intake          ← chat-style intent input
  ├─ /student/workflow/[id]   ← canvas + step pane
  └─ /coordinator/dashboard   ← briefing queue

Next.js API routes (serverless)
  ├─ /api/intake              ← extractIntent
  ├─ /api/plan                ← planWorkflow + persistPlan
  ├─ /api/workflow/[id]       ← read full workflow state
  ├─ /api/step/[id]           ← record response → tryAdvance
  ├─ /api/admin/queue         ← list pending briefings
  └─ /api/admin/decision      ← approve/reject → advance

GLM Service Layer (lib/glm/)
  ├─ client.ts                ← Z.AI SDK wrapper, mock mode, retry, latency
  ├─ schemas.ts               ← Zod schemas for every endpoint I/O
  ├─ trace.ts                 ← writes glm_reasoning_trace
  ├─ prompts/*.md             ← versioned system prompts
  ├─ extractIntent / planWorkflow / adaptStep / routeDecision
  ├─ parseDocument / generateBriefing
  └─ citationVerifier         ← strips hallucinated regulation refs

Workflow Engine (lib/workflow/)
  ├─ persistPlan              ← GLM plan JSON → DB rows
  └─ stageEngine              ← advance, route at decision nodes

Knowledge Base (lib/kb/)
  ├─ seed/*.md                ← UM procedure SOPs (canonical source for GLM)
  └─ retrieve.ts              ← fetch SOP chunks for a procedure

Supabase (managed)
  ├─ Postgres + pgvector      ← workflows, traces, KB embeddings
  ├─ Storage                  ← uploaded documents (signed URLs)
  └─ Auth                     ← email + magic link
```

See `docs/SAD.md` for full architecture diagrams (component, sequence, ERD, DFD).

---

## 🔑 Where GLM is load-bearing

| Endpoint | What GLM does | Without GLM |
|---|---|---|
| `extractIntent` | Classifies free-text → procedure_id with confidence | User has to pick from a dropdown |
| `planWorkflow` | Reads SOP + profile → emits stages/edges/decisions | No workflow exists |
| `adaptStep` | Rewords each question for the student's context | Robotic generic forms |
| `routeDecision` | Reasons over actual responses to pick a branch | Regex over form fields, brittle |
| `parseDocument` | Extracts structured fields from PDF/image | Manual data entry |
| `generateBriefing` | Pre-digests submission for the staff reviewer | Staff re-reads raw form |

**Pull GLM out → UniGuide is dead.** This satisfies the hackathon brief.

---

## 📁 Project structure

```
UniGuide/
├── app/                    Next.js App Router routes
│   ├── api/                API endpoints
│   ├── student/            student-facing pages
│   ├── coordinator/        staff-facing pages
│   ├── layout.tsx
│   ├── page.tsx            landing
│   └── globals.css
├── components/             React components
│   ├── canvas/             ReactFlow nodes + workflow canvas
│   ├── steps/              step renderer
│   ├── intake/
│   └── admin/
├── lib/
│   ├── glm/                GLM service layer (the heart of the app)
│   ├── workflow/           stage engine + plan persistence
│   ├── kb/                 SOP knowledge base
│   ├── supabase/           browser/server clients
│   ├── output/             PDF/email/.ics generators (TODO)
│   └── utils/
├── supabase/
│   └── migrations/         versioned SQL migrations
├── tests/
│   └── fixtures/
│       ├── glm/            canned GLM responses for mock mode + tests
│       └── documents/      sample uploads
├── scripts/
│   └── seed-kb.ts          rebuilds procedure_sop_chunks from lib/kb/seed/*.md
├── docs/                   hackathon deliverables (PRD, SAD, QATD, pitch)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md (this file)
```

---

## ✅ What's done vs TODO (as of submission prep)

### Done
- Project scaffold (Next.js 15 + Tailwind + Supabase + ReactFlow)
- Database schema + RLS + KB tables (4 migrations)
- GLM service layer with mock mode (extractIntent, planWorkflow, routeDecision, adaptStep, parseDocument, generateBriefing)
- Versioned prompts in `lib/glm/prompts/`
- Workflow engine (persistPlan + stageEngine + tryAdvanceWorkflow)
- API routes for intake, planning, step submission, admin queue, admin decision
- UI: landing page, intake chat, workflow canvas, step panel, coordinator dashboard
- KB seed for Scholarship Application (primary demo) and Postgrad Admission
- Mock fixtures for the demo flow

### TODO (for final-round polish)
- [ ] Submit endpoint that triggers `generateBriefing` → creates pending admin_briefing
- [ ] Document text extraction (`lib/documents/extractText.ts`) — `pdf-parse` for PDFs, `tesseract.js` for images
- [ ] Structured output bundle generation (PDF form fill, `.ics` calendar, email drafts)
- [ ] Embedding generation in `seed-kb.ts` (currently writes `embedding=null`)
- [ ] Authentication UI (login / signup pages — currently relies on Supabase magic link)
- [ ] Test fixtures for `intent_unknown`, `route_proceed` (only the most common are in)
- [ ] Vitest unit tests for `validateGraph`, `verifyCitations`, schema validators
- [ ] Playwright E2E for the golden path (TC-01 in QATD)
- [ ] Sentry integration
- [ ] Upstash rate limiter wired into `lib/glm/client.ts`
- [ ] Coordinator-side stage view (currently they only see briefings)

---

## 🛠️ Common dev tasks

### Run type check
```bash
npm run typecheck
```

### Run tests
```bash
npm test
```

### Re-seed KB after editing SOPs
```bash
npm run seed:kb
```

### Add a new procedure
1. Add it to `lib/glm/schemas.ts` `ProcedureIdSchema`.
2. Add a row to `supabase/migrations/0004_seed_procedures.sql` (or run an INSERT in SQL editor).
3. Drop a markdown file in `lib/kb/seed/{procedure_id}.md` with the SOP content.
4. Run `npm run seed:kb`.
5. Add a mock fixture `tests/fixtures/glm/plan_{procedure_id}.json` for offline testing.
6. Update the heuristic in `lib/glm/extractIntent.ts:pickIntentFixture()` so mock mode picks the right fixture.

### Add a new GLM endpoint
1. Define input/output Zod schemas in `lib/glm/schemas.ts`.
2. Write a system prompt in `lib/glm/prompts/{name}.md`.
3. Create `lib/glm/{name}.ts` following the pattern of `extractIntent.ts`.
4. Always go through `callGlm()` from `client.ts` — never call the OpenAI SDK directly.
5. Always write a trace via `writeTrace()`.

---

## 📝 License & IP

This codebase is **submitted to UMHackathon 2026** under the hackathon's terms (Section 9 of the T&Cs: "All rights concerning the code submission and working prototype shall belong to the domain collaborators."). It is built specifically for this hackathon and has not been submitted to any other event.

---

## 🙏 Credits

- Built by **Team Breaking Bank** — Jeanette Tan En Jie (Group Leader), Teo Zen Ben (Technical Lead), Nyow An Qi, Thevesh A/L Chandran — for **UMHackathon 2026** — Faculty of Computer Science & Information Technology, Universiti Malaya.
- Powered by **Z.AI GLM** (mandatory model per hackathon rules).
- UM procedure SOPs sourced from official `um.edu.my` PDFs and faculty pages — see `lib/kb/seed/*.md` for individual citations.
