# UniGuide — UMHackathon 2026 Domain 1 · Team 108

🏆 **Finalist · Final Round in progress (29 Apr – 3 May 2026)**

---

## 📤 Final Round Deliverables (Team 108)

> Per the UMHackathon 2026 Finalist Handbook §Rules & Deliverables: *"You will submit one Link (Github Repo) and Include these Deliverables in the First Section of Your Readme for easier access."* This section is that index.

| # | Deliverable | Format | Location |
|---|---|---|---|
| 1 | **Code Repository** | this repo | [github.com/ZenBen5173/uniguide](https://github.com/ZenBen5173/uniguide) |
| 2 | **Refined Quality Assurance Testing Document** | PDF | [docs/03 Finals/QATD-Refined.pdf](docs/03%20Finals/QATD-Refined.pdf) |
| 3 | **Deployment Plan** | PDF | [docs/03 Finals/DeploymentPlan.pdf](docs/03%20Finals/DeploymentPlan.pdf) |
| 4 | **Business Proposal** *(for the Developed Product)* | PDF | [docs/03 Finals/BusinessProposal.pdf](docs/03%20Finals/BusinessProposal.pdf) |
| 5 | **Final Round Presentation Pitch Deck** | PDF | [docs/03 Finals/Breaking Bank Pitch Deck No. 108.pdf](docs/03%20Finals/Breaking%20Bank%20Pitch%20Deck%20No.%20108.pdf) |

**Live deploy:** [uniguide-blush.vercel.app](https://uniguide-blush.vercel.app)
**Final submission deadline:** 3 May 2026 07:59:59 AM (via [umhackathon.com](https://umhackathon.com))
**Final pitching:** 3 May 2026 10:00 AM at KPS Auditorium · 10 min pitch + 5 min Q&A

All deliverable PDFs include the mandatory **Z.AI** and **YTL AI LABS** logos as required by the handbook.

<details>
<summary>Preliminary round submission (archived, 26 Apr 2026)</summary>

For reference — the preliminary round submitted these six artefacts before the 26 Apr 07:59:59 cut-off:

| # | Deliverable | Location |
|---|---|---|
| 1 | Product Requirement Document | [docs/02 Pre Finals/PRD.pdf](docs/02%20Pre%20Finals/PRD.pdf) |
| 2 | System Analysis Document | [docs/02 Pre Finals/SAD.pdf](docs/02%20Pre%20Finals/SAD.pdf) |
| 3 | Quality Assurance Testing Document | [docs/02 Pre Finals/QATD.pdf](docs/02%20Pre%20Finals/QATD.pdf) |
| 4 | Preliminary Round Pitch Deck | [docs/02 Pre Finals/UniGuide Pitch Deck - Team  108.pdf](docs/02%20Pre%20Finals/UniGuide%20Pitch%20Deck%20-%20Team%20%20108.pdf) |
| 5 | 10-Minute Pitching Video with Prototype Demo | [drive.google.com/file/d/16L2_T-khNYYDi3OzbGH9d1iuW_delH9G/view](https://drive.google.com/file/d/16L2_T-khNYYDi3OzbGH9d1iuW_delH9G/view?usp=sharing) |
| 6 | Code Repository | [github.com/ZenBen5173/uniguide](https://github.com/ZenBen5173/uniguide) |

</details>

---

## What is UniGuide?

**Your AI co-pilot for university paperwork.** UniGuide guides Universiti Malaya students through complex multi-step administrative procedures (scholarship applications, FYP, deferment, exam appeal, postgrad admission, EMGS visa renewal). **Z.AI's GLM** emits the next step in each application **at runtime, one at a time**, based on the student's history + the official UM SOP. Coordinators get a pre-digested briefing per submission, can preview/edit/send GLM-generated decision letters, and have a 5-minute undo. Pull GLM out and no application can advance past step 1 — there is no static workflow template.

- 📚 **Internal references:** Official UMHackathon briefs (incl. **Finalist Handbook**) under [docs/01 Hackathon Info/](docs/01%20Hackathon%20Info/).

---

## ⚡ Try the demo (zero credentials)

The fastest way to see UniGuide is the live deploy:

1. Open https://uniguide-blush.vercel.app → click **"Try the demo →"**
2. Pick a demo tile (one click, no password):
   - 🎓 **Student** — `demo-student@uniguide.local`
   - 💼 **Coordinator** — `demo-coordinator@uniguide.local`
   - 🛠 **Admin** — `demo-admin@uniguide.local`
3. **The "Reset demo data" chip** at the top of the login page wipes everything back to canonical state — wipes ALL applications + non-canonical procedures + reseeds **5 sample applications, one per procedure**, each in a distinct lifecycle state (Scholarship: low-conf + BLOCK flag · FYP: near-complete draft ready for upload-and-submit · Deferment: approved + letter delivered · Postgrad: submitted high-conf · Exam Appeal: more_info_requested). Inbox / analytics / GLM trace pages have content immediately.
4. Switch tabs to Coordinator → see the same applications from the staff side. Try **Preview & approve** on the Postgrad submission — the modal shows the GLM-generated letter, editable, with hallucination check.

A demo banner is visible at the top of every page when the deploy is in mock mode.

---

## 🛠 Local development

### Prerequisites
- Node.js 20+ and npm 10+
- Supabase project (free tier is fine) — Postgres + Auth + Storage + Realtime
- Optional: Z.AI account + GLM API key (the app runs in mock mode without one)

### 1 — Install
```bash
npm install
```

### 2 — Configure environment
```bash
cp .env.example .env
```
Fill in `.env`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API)
- `ZAI_API_KEY` (or leave empty + set `GLM_MOCK_MODE=true` for offline dev)
- `ZAI_API_BASE_URL=https://api.z.ai/api/paas/v4`
- `ZAI_MODEL_PRIMARY=glm-4.6`, `ZAI_MODEL_FAST=glm-4.5-flash`

### 3 — Apply migrations
```bash
# If you have the Supabase CLI linked to your project:
npx supabase db push
```
or paste each `supabase/migrations/0001..0015` SQL file into the Supabase SQL editor in order.

### 4 — Seed the SOP knowledge base
```bash
npm run seed:kb
```
This reads each `lib/kb/seed/*.md`, chunks by H2 heading + word count, and writes to `procedure_sop_chunks`.

### 5 — Run
```bash
npm run dev
# → http://localhost:3000
```

### Mock mode vs live mode
- **`GLM_MOCK_MODE=true`** (or no `ZAI_API_KEY`) → every GLM call returns a recorded fixture from `tests/fixtures/glm/*.json`. Lavender demo banner appears at top of every page.
- **`GLM_MOCK_MODE=false`** + valid `ZAI_API_KEY` → real Z.AI calls. **Auto-fallback:** if a real call errors AND a `mockFixture` is named, returns the fixture with logged error so the demo never collapses (logged to `console.error`, marked `model: …-fallback` in the trace).

---

## 🏗 Architecture (TL;DR)

```
Browser (3 role surfaces — student/coordinator/admin)
   │
   ├─ Next.js 15 App Router · ~30 API routes
   │     ├─ Application engine (lib/applications/engine.ts)
   │     │     • emitNextStep — calls GLM nextStep; persists step
   │     │     • recordResponseAndAdvance — records → emits next
   │     │
   │     └─ GLM Service Layer (lib/glm/)
   │           • client.ts — single callGlm + auto-fallback + tracing
   │           • schemas.ts — Zod for every GLM I/O
   │           • nextStep / generateBriefing / fillLetter
   │           • estimateProgress / suggestComment (inline)
   │           • prompts/*.md — versioned system prompts
   │           → Z.AI GLM (glm-4.6 + glm-4.5-flash, JSON mode)
   │
   └─ Supabase
         • Postgres + pgvector (14 tables, RLS-protected)
         • Storage (application-files bucket, owner+staff RLS)
         • Auth (OTP email + demo password tiles)
         • Realtime (4 published tables for instant client updates)

Hosted on Vercel (sin1 — Singapore) ↔ Supabase (ap-northeast-2 — Seoul) ≈ 70ms RTT
```

For full diagrams (component, sequence, ERD, DFD) see [docs/SAD.pdf](docs/SAD.pdf).

---

## 🔑 Where GLM is load-bearing

| Endpoint | What GLM does | Without GLM |
|---|---|---|
| **nextStep** | Reads SOP + complete history → emits the next step (type, prompt_text, config, citations) | Application can't advance past step 1 — no static template exists |
| **generateBriefing** | Pre-digests submission for the coordinator: extracted facts, flags, recommendation, confidence | Coordinator stares at raw form data |
| **fillLetter** | Fills the procedure's `{{placeholder}}` template against application context | Coordinator hand-writes every letter |
| **suggestComment** | Drafts a 1-3 sentence coordinator comment from the briefing flags + intent | Blank text box |
| **estimateProgress** | Returns rough total step count for the progress bar | "Unknown — keep going" |

**Pull GLM out → UniGuide is unable to plan, advance, brief, or decide on a single application.** This satisfies the hackathon brief by design.

---

## 📁 Project structure

```
UniGuide/
├── app/                            Next.js App Router
│   ├── api/                        ~30 API route handlers
│   ├── admin/                      procedures library, analytics, GLM traces
│   ├── coordinator/                inbox + detail
│   ├── student/                    portal + smart application
│   ├── letters/[id]/print/         printable letter page
│   ├── settings/profile/           profile editor
│   ├── login/                      3 demo tiles + OTP
│   ├── onboarding/                 first-time student setup
│   └── page.tsx                    landing
│
├── components/
│   ├── admin/                      AdminProcedures, LetterTemplateEditor,
│   │                               DeadlineEditor, GlmTraceList
│   ├── coordinator/                CoordinatorInbox, CoordinatorAppDetail,
│   │                               InternalNotes
│   ├── student/                    StudentPortal, SmartApplication,
│   │                               StepRenderers, SopViewer
│   └── shared/                     TopBar, NotificationBell, MessageThread,
│                                   DemoModeBanner, ProcedureIcon, PrintTrigger
│
├── lib/
│   ├── applications/engine.ts      step emission + advance
│   ├── auth/guards.ts              requireUser, requireRole
│   ├── glm/                        GLM service layer (the heart)
│   │   ├── client.ts               single callGlm + auto-fallback
│   │   ├── schemas.ts              Zod for every GLM I/O
│   │   ├── nextStep.ts
│   │   ├── generateBriefing.ts
│   │   ├── fillLetter.ts
│   │   ├── estimateProgress.ts
│   │   ├── trace.ts                logs every call to glm_reasoning_trace
│   │   └── prompts/*.md            versioned system prompts
│   ├── kb/                         SOP knowledge base seed + retrieval
│   ├── supabase/                   browser + server clients
│   └── utils/responses.ts          apiSuccess / apiError helpers
│
├── supabase/migrations/            15 numbered SQL migrations
├── tests/fixtures/glm/             recorded GLM responses for mock mode
├── tests/glm-mock.test.ts          smoke test for the mock-mode resilience paths
├── scripts/                        seed-kb.ts, probe-ilmu.ts
├── docs/                           PITCH_DECK · PRD · SAD · QATD · MVP_STATUS
├── next.config.ts                  pdf-parse marked serverExternalPackages
├── vercel.json                     pinned to sin1 region
└── README.md (this file)
```

---

## ✅ What's done (synced 2026-04-20)

**28 shipped features (PRD §F1–F28).** Highlights:

- **Three role surfaces** — Student / Coordinator / Admin, each with a complete primary flow
- **AI step emission** — turn-by-turn via GLM `nextStep`, with SOP citations persisted into `step.config.citations`
- **Citation chips** — clickable on every AI step, opens the SOP viewer scrolled to that section
- **Coordinator briefing** — extracted facts + flags + recommendation + confidence + plain-English label
- **Preview & edit letter** — modal with editable text + hallucination check (CGPA/name/year/faculty/programme mismatches flagged before send)
- **Undo decision** — 5-minute window with mm:ss countdown
- **Coordinator AI-suggest** — three pills draft a comment from briefing + intent
- **Coordinator claim/assignee** — advisory; "Mine" filter on inbox
- **Bulk actions** — bulk-approve (auto-excludes flagged) + bulk-request-info
- **Real file upload** — Supabase Storage `application-files` bucket, RLS-protected, signed URLs
- **Auto-save** — real localStorage persistence per-step, hydrates on reopen
- **Realtime** — Supabase Realtime publication on `applications`, `application_steps`, `application_letters`, `application_messages`
- **Message thread** — student↔coordinator chat, realtime
- **Internal notes** — staff-only, never visible to student
- **Step revise** — student can edit a previous answer; AI replans
- **Application withdraw** — student can cancel from any pre-decision state
- **Notification bell** — last 14 days of events, unread count via localStorage
- **Letter print** — clean printable page (UM letterhead) at `/letters/[id]/print`
- **Admin SOP upload** — paste / URL / **PDF** (real `pdf-parse`)
- **Admin letter template editor** — list / edit / delete with sensible defaults; placeholders auto-detected
- **Admin deadline editor** — date + display label per procedure
- **Admin analytics** — KPIs + by-procedure table + status mix
- **Admin GLM trace viewer** — every call's input/output JSON
- **Demo seed variety** — 5 sample applications, one per procedure, via `/api/demo/reset` (no visual duplicates on the portal — each card is a different procedure name in a different lifecycle state); manual reset chip on the login page so judges always see canonical state
- **Mock mode + demo banner + auto-fallback** — demo never collapses; submit / decide endpoints additionally degrade gracefully if a real GLM call fails (fallback briefing or raw-template letter so the application is never left in a half-state)
- **Dual AI providers** — Z.AI GLM-4.6 / GLM-4.5-flash for all six call-sites by default; coordinator briefing optionally routes through ILMU `ilmu-glm-5.1` (Malaysia's sovereign LLM, YTL AI Labs × UM) when `USE_ILMU_FOR_BRIEFING=true`

For per-feature traceability to test cases, see [docs/QATD.pdf](docs/QATD.pdf).

---

## 🗺 Roadmap (out of MVP scope)

- Email delivery via SMTP (currently in-app letter delivery)
- Server-side PDF generation (currently browser print)
- OCR for image-only PDFs (currently rejected explicitly)
- Bahasa Melayu UI (currently English only)
- Voice intake
- Real MAYA / SiswaMail / SPeCTRUM / EMGS API integrations
- Multi-tenant isolation
- Native mobile apps
- Push notifications

---

## 🧰 Common dev tasks

```bash
npm run dev          # local dev server
npm run build        # production build (Vercel runs this on every push)
npm run typecheck    # tsc --noEmit (TypeScript strict)
npm run lint         # next lint
npm test             # vitest watch
npm run test:run     # vitest run once
npm run seed:kb      # rebuild procedure_sop_chunks from lib/kb/seed/*.md
npm run probe:ilmu   # one-shot diagnostic — verify ILMU API key + model access
```

### Add a new procedure
1. Add the id to `lib/glm/schemas.ts` `ProcedureIdSchema`.
2. Either `INSERT INTO procedures` directly or use the admin UI (`/admin` → `+ New procedure`).
3. Drop the SOP markdown file in `lib/kb/seed/{procedure_id}.md` (chunked by `## H2` sections).
4. Run `npm run seed:kb` (or use the admin SOP upload modal — paste / URL / PDF).
5. Add letter templates via the admin procedure-detail page.
6. (Optional, for offline mock-mode demo) Add fixtures `tests/fixtures/glm/next_step_{procedure_id}_*.json`.

### Add a new GLM endpoint
1. Define I/O schemas in `lib/glm/schemas.ts` with Zod.
2. Write the system prompt in `lib/glm/prompts/{name}.md`.
3. Create `lib/glm/{name}.ts` following the pattern of `nextStep.ts`.
4. Always go through `callGlm()` from `client.ts` — never call the OpenAI SDK directly.
5. `callGlm` writes a trace row automatically; if your endpoint should pass an applicationId for trace correlation, plumb it through.
6. Add a fixture for mock mode with the matching `mockFixture` name.

### Apply a new schema migration
1. Number the file `supabase/migrations/0016_*.sql` (next free slot — `0015_realtime_replica_identity.sql` is the latest).
2. Apply to Supabase (CLI: `npx supabase db push`, or paste in SQL editor).
3. Commit the migration file so the repo history matches the live DB.
4. If the migration affects a table that should be realtime, add it to `supabase_realtime` publication AND set `replica identity full` on it (per `0015_*` — needed for filtered UPDATE events to fire).
5. If RLS-protected, add policies for the relevant roles.

---

## 📝 License & IP

This codebase is **submitted to UMHackathon 2026** under the hackathon's terms (Section 9 of the T&Cs: "All rights concerning the code submission and working prototype shall belong to the domain collaborators."). Built specifically for this hackathon and not submitted to any other event.

---

## 🙏 Credits

- Built by **Team Breaking Bank** — Jeanette Tan En Jie (Group Leader) · Teo Zen Ben (Technical Lead) · Nyow An Qi · Thevesh A/L Chandran — for **UMHackathon 2026** at the Faculty of Computer Science & Information Technology, Universiti Malaya.
- Powered by **Z.AI GLM** (mandatory model per hackathon rules).
- UM procedure SOPs sourced from official `um.edu.my` PDFs and faculty pages — see `lib/kb/seed/*.md` for individual citations.

---

**README v2.1 — synced with shipped state as of 2026-04-25**
