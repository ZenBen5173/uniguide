# UniGuide — Task Tracker

**Team Breaking Bank · UMHackathon 2026 · Domain 1**

Lightweight task tracker for the submission run-up. For grounded "what works / what doesn't" against the actual code, see [`docs/MVP_STATUS.md`](docs/MVP_STATUS.md). For test cases, see [`docs/QATD.md`](docs/QATD.md).

---

## 🟢 Done

### Build
- [x] Next.js 15 + Supabase + Z.AI GLM service layer (no ReactFlow — v1 architecture replaced by step-emission engine)
- [x] 15 numbered SQL migrations + RLS + pgvector + procedure seeds (gap-free; missing `0005` was backfilled on 2026-04-25)
- [x] 6 GLM endpoints (`nextStep`, `generateBriefing`, `fillLetter`, `estimateProgress`, `extractIntent`, `parseDocument`) + mock-mode fixtures + auto-fallback + reasoning-trace logging
- [x] ILMU (YTL AI Labs × UM) wired as secondary provider for the coordinator briefing — env-flagged `USE_ILMU_FOR_BRIEFING=true`. `lib/ilmu/client.ts` + probe script `npm run probe:ilmu`
- [x] Application engine (`lib/applications/engine.ts`) — start, respond-and-advance, coordinator-emitted steps, submit
- [x] All ~30 API routes (student, coordinator, admin, demo)
- [x] All UI surfaces (landing, login w/ demo tiles, student portal & SmartApplication, coordinator inbox & decide, admin procedures + analytics + GLM-traces, settings/profile, onboarding, letter print)
- [x] Knowledge-base seeds for **5 live procedures**: scholarship_application, postgrad_admission, final_year_project, deferment_of_studies, exam_result_appeal (+ emgs_visa_renewal as Coming-soon)
- [x] Mock GLM fixtures for offline demo (every named `mockFixture` covered)
- [x] Demo seed: 9 sample applications across 4 procedures via `/api/demo/reset` — auto-fires on every demo-tile sign-in (no separate Reset button needed)
- [x] Realtime correctness: `REPLICA IDENTITY FULL` on `applications`, `application_steps`, `application_letters`, `application_messages` so filtered UPDATE events deliver

### Resilience
- [x] Submit fallback: if `generateBriefing` errors, write placeholder briefing + still flip status to `submitted`
- [x] Decide fallback: if `fillLetter` errors, write raw template as letter rather than silently emitting nothing
- [x] `final_submit` step rejected by `/respond` endpoint (must use `/submit`)
- [x] First smoke test (`tests/glm-mock.test.ts`) — `npm test` passes 4/4

### Ops
- [x] GitHub repo: https://github.com/ZenBen5173/uniguide
- [x] Supabase project provisioned (sin1-adjacent: ap-northeast-2), RLS enabled, all migrations applied
- [x] Live deploy: https://uniguide-blush.vercel.app (also git-main alias)
- [x] Vercel env: `ZAI_API_KEY`, `ILMU_API_KEY`, `USE_ILMU_FOR_BRIEFING`, `SUPABASE_*`, optional Upstash + Sentry
- [x] `.env.example` matches the env vars actually read by code

### Docs
- [x] PRD ([docs/PRD.md](docs/PRD.md)) — synced with shipped state, ILMU dual-provider documented
- [x] SAD ([docs/SAD.md](docs/SAD.md)) — architecture, ERD, DFD, sequence diagrams; 15 migrations
- [x] QATD ([docs/QATD.md](docs/QATD.md)) — risk matrix, test cases, AI tests
- [x] PITCH_DECK content draft ([docs/PITCH_DECK.md](docs/PITCH_DECK.md))
- [x] MVP_STATUS ([docs/MVP_STATUS.md](docs/MVP_STATUS.md)) — frank "works / doesn't / gaps" reference grounded in code
- [x] README ([README.md](README.md)) v2.1 (synced 2026-04-25)

---

## 🟡 Outstanding for submission (2026-04-26 07:59)

- [ ] **Pick the deck tagline** — "STOP GUESSING. START GRADUATING." was rejected as off-message; UM-marketing-audience options proposed (e.g. "THE OPERATING SYSTEM FOR UM PROCEDURES.", "FASTER DECISIONS. FAIRER OUTCOMES. FEWER EMAILS.", "A DIGITAL UM — BUILT BY UM, FOR UM."). Decision pending. *(Owner: Jeanette)*
- [ ] Convert `docs/PITCH_DECK.md` content into actual slides (Canva / Slides / Pitch.app) — tagline still TBD; UM-marketing-audience options drafted. *(Owner: Jeanette)*
- [ ] Record pitch video (10 minutes max). *(Owner: TBD)*
- [ ] Final submission via UMHackathon portal. *(Owner: Jeanette)*

---

## 🔵 Out of MVP scope (post-hackathon)

Documented as known gaps in `docs/MVP_STATUS.md`. None block the demo:

- Email/SMS notifications (currently in-app realtime only)
- OCR for image-only PDFs (`pdf-parse` rejects them with a friendly message)
- Server-side PDF generation for letters (currently browser-print)
- Embeddings on `procedure_sop_chunks` (currently `NULL` — procedure-scoped fetch is fine for 5 procedures)
- Multi-tenancy (single-UM hardcode)
- Per-faculty inbox scoping
- Inbox pagination
- Bahasa Melayu UI
- Real MAYA / SiswaMail / EMGS API integrations
- 7 moderate `npm audit` warnings (all transitive; `--force` fix would touch breaking-change versions)

---

## 📅 Timeline (final stretch)

| Date | Owner | Milestone |
|---|---|---|
| Sat 25 Apr | Team | Final code review + cleanup + MVP doc + dry-run |
| Sun 26 Apr 07:59 | Jeanette | **Final submission** |

---

## ❓ Open questions

- None blocking submission.
