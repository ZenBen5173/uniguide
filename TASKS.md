# UniGuide — Task Tracker

**Team Breaking Bank · UMHackathon 2026 · Domain 1**

Lightweight task list for the preliminary round. Update by editing this file.
For test results, defects, and AI output validation, see [`docs/QATD.md`](docs/QATD.md).

---

## 🟢 Done

- [x] Hackathon problem statement reviewed (Domain 1, AI Workflow Automation)
- [x] Vertical chosen: university administrative procedures (UM)
- [x] Six UM procedures researched with stages, branching, forms (see memory + SAD)
- [x] PRD drafted ([docs/PRD.md](docs/PRD.md))
- [x] SAD drafted with architecture, ERD, DFD, sequence diagrams ([docs/SAD.md](docs/SAD.md))
- [x] QATD drafted with risk matrix, 19 test cases, AI tests ([docs/QATD.md](docs/QATD.md))
- [x] Pitch deck content drafted ([docs/PITCH_DECK.md](docs/PITCH_DECK.md))
- [x] Code skeleton: Next.js 15 + Supabase + ReactFlow + GLM service layer
- [x] Database schema (4 migrations + RLS + pgvector + procedure seeds)
- [x] GLM service layer (6 endpoints + mock mode + versioned prompts + reasoning trace)
- [x] Workflow engine (persist plan, stage advancement, decision routing)
- [x] API routes (intake, plan, step, submit, admin queue, admin decision)
- [x] UI: landing, intake chat, workflow canvas, step panel, coordinator dashboard
- [x] Knowledge base seed: Scholarship Application (primary demo), Postgrad Admission
- [x] Mock GLM fixtures for offline demo
- [x] README with setup instructions
- [x] GitHub repo created — https://github.com/ZenBen5173/uniguide
- [x] Supabase project provisioned, 4 migrations applied, 6 procedures + 24 KB chunks seeded
- [x] Live deployment on Vercel — https://uniguide-blush.vercel.app (mock mode active)
- [x] End-to-end smoke test passed (landing, intake, dashboard, auth-gated API routes all 200/401 as expected)

## 🟡 In progress / blocked on inputs

- [ ] **Z.AI GLM API key** — once obtained, drop in `.env` as `ZAI_API_KEY` and set `GLM_MOCK_MODE=false`. *(Owner: Zen Ben)*
- [ ] **Supabase project** — create new project, add credentials to `.env`, apply 4 migrations from `supabase/migrations/`. *(Owner: Zen Ben)*
- [ ] **Run `npm install`** on each teammate's machine. *(Owner: each teammate)*
- [ ] **Confirm role split** for Nyow An Qi and Thevesh A/L Chandran (frontend/UX vs QA/pitch). *(Owner: Jeanette)*

## 🔴 Outstanding work for submission

### Critical (blocks submission)
- [x] Push code to GitHub `main` branch — https://github.com/ZenBen5173/uniguide
- [x] Deploy to Vercel — https://uniguide-blush.vercel.app
- [ ] Wire real GLM API key + verify end-to-end scholarship application demo
- [ ] Record pitch video (10 minutes max, see [docs/PITCH_DECK.md](docs/PITCH_DECK.md) for script + timings) *(Owner: TBD)*
- [ ] Convert `docs/PITCH_DECK.md` content into actual slides (Canva/Slides/Pitch.app) *(Owner: TBD)*
- [ ] Submit via official UMHackathon website by 2026-04-26 07:59 *(Owner: Jeanette)*

### Important (improves judging score)
- [ ] Implement the submit → briefing UI flow on the workflow page (button + redirect)
- [ ] Document text extraction (`lib/documents/extractText.ts`) using `pdf-parse` + `tesseract.js`
- [ ] Wire `parseDocument` into the upload step in `StepPanel.tsx`
- [ ] PDF form fill for Yayasan UM application form (use `pdf-lib` or similar)
- [ ] Embedding generation in `scripts/seed-kb.ts` (currently writes `embedding=null`)
- [ ] Vitest unit tests for `validateGraph`, `verifyCitations`, schema validators
- [ ] Playwright golden-path test (TC-01 from QATD)
- [ ] Populate the `[TBD]` "Actual" columns in QATD test cases after running the suite

### Nice to have (polish)
- [ ] Authentication UI (login/signup pages — currently relies on Supabase magic link)
- [ ] Coordinator-side stage view (currently only sees briefings)
- [ ] Sentry integration (`sentry.client.config.ts` etc.)
- [ ] Upstash Redis rate limiter wired into `lib/glm/client.ts`
- [ ] Improved canvas layout (dagre instead of ordinal-based positioning)
- [ ] Postgrad Admission demo flow polish (currently has KB + fixture but no end-to-end UI run)
- [ ] Custom branding (currently generic blue brand-600 — pick UM colours?)

---

## 📅 Timeline

| Date | Owner | Milestone |
|---|---|---|
| Sat 18 Apr | Zen Ben + Claude | Docs + code skeleton built |
| Sun 19 Apr | — | (Zen Ben unavailable) |
| Mon 20 Apr | Team review | Read docs, push to GitHub, wire keys |
| Tue 21 Apr | Team build | Live demo runs end-to-end |
| Wed 22 Apr | Team test | Test cases pass; QATD updated with actuals |
| Thu 23 Apr | Pitch team | Slides built from PITCH_DECK.md |
| Fri 24 Apr | Pitch team | Video recorded |
| Sat 25 Apr | Team | Final QA + dry-run |
| Sun 26 Apr 07:59 | Jeanette | **Final submission** |

---

## ❓ Open questions to resolve

- Pick a brand colour palette (default: generic blue) — UM blue/yellow?
- Confirm Vercel team account vs. personal account for hosting
- Decide whether to link to a live demo URL in the pitch deck or use a recorded video only
