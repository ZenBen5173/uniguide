# UniGuide — MVP Status

**Last reviewed:** 2026-04-25 · **Current branch:** `main` · **Live:** [uniguide-git-main-zenben5173s-projects.vercel.app](https://uniguide-git-main-zenben5173s-projects.vercel.app)

This document records what works end-to-end on UniGuide today, what's stubbed or partially-wired, and what would need to happen before this is genuinely production-grade. It complements (and supersedes when in conflict) the claims in the submitted `PRD.pdf`, `SAD.pdf`, and `QATD.pdf` (plus the slide deck) — those are forward-looking; this is grounded in the code as of the date above.

---

## ✅ End-to-end flow that works

The full **student → AI → coordinator → letter → student** loop is wired and works on the live site:

| Step | What runs | Where |
|---|---|---|
| Student signs in | Supabase OTP or 1-click demo tile | `app/login/page.tsx` |
| Student starts an application | `POST /api/applications` → writes `applications` row + emits Step 1 | `app/api/applications/route.ts`, `lib/applications/engine.ts:emitNextStep` |
| AI emits next step | GLM-4.6 reads SOP + history, returns `{type, prompt_text, config, citations}` | `lib/glm/nextStep.ts` |
| Student answers | `POST /api/applications/[id]/respond` → marks step completed → triggers next emission | `app/api/applications/[id]/respond/route.ts` |
| Student submits | `POST /api/applications/[id]/submit` → flips status to `submitted` + generates briefing inline | `app/api/applications/[id]/submit/route.ts` |
| Briefing is generated | GLM-4.6 (or ILMU `ilmu-glm-5.1` when `USE_ILMU_FOR_BRIEFING=true`) digests history into facts + flags + recommendation | `lib/glm/generateBriefing.ts` |
| Coordinator opens inbox | `GET /api/coordinator/inbox` enriches applications with briefing flags + AI rec | `app/api/coordinator/inbox/route.ts` |
| Coordinator decides | `POST /api/coordinator/applications/[id]/decide` writes to `application_decisions`, generates letter, flips status | `app/api/coordinator/applications/[id]/decide/route.ts` |
| Letter goes out | `fillLetter` GLM call + insert into `application_letters`. Hallucination-check runs in preview-letter endpoint. | `lib/glm/fillLetter.ts` |
| Realtime back to student | Supabase publication on `applications` + `application_steps` + `application_letters` (+ `REPLICA IDENTITY FULL` so UPDATE filters work) | `supabase/migrations/0008_realtime_applications.sql`, `0015_realtime_replica_identity.sql` |

### Per-role coverage

**Student** — landing/portal, start, step-by-step flow, draft auto-save (localStorage + debounced), file upload via Supabase Storage, withdraw, message thread, view SOP, see decisions/letters in realtime.

**Coordinator** — SLA-aware inbox with keyboard shortcuts (`j/k/Enter//`), claim/release, AI briefing pre-loaded with extracted facts + flags + AI rec, preview & edit letter with hallucination check, internal notes, suggest-comment via GLM, bulk approve / bulk request-info, undo decision within 5 min.

**Admin** — manage procedures (paste / URL / PDF upload via `pdf-parse`), letter-template editor per procedure + per type (acceptance / rejection / request-info), deadline editor, `/admin/glm-traces` shows every AI call with latency / tokens / confidence, `/admin/analytics` rollups, demo reset.

**AI** — 6 call-sites in `lib/glm/`, all with mock-fallback fixtures so a missing key never breaks the demo: `nextStep`, `generateBriefing` (dual-provider), `estimateProgress`, `extractIntent`, `fillLetter`, `parseDocument`. ILMU client mirrors the GLM pattern.

---

## ⚠️ Known incomplete / partially-wired

Things the code clearly knows about but doesn't fully deliver. These are MVP-acceptable but worth flagging.

| Item | Severity | Status | Where |
|---|---|---|---|
| **Vector embeddings unused** | 🟡 medium | `procedure_sop_chunks.embedding` is `NULL` — the seed script intentionally skips embedding generation. KB retrieval (`lib/kb/retrieve.ts`) falls back to a procedure-scoped fetch, not semantic search. Works fine for the demo's 5 procedures × ~10 chunks each; will degrade as the catalogue grows. | `scripts/seed-kb.ts`, `lib/kb/retrieve.ts` |
| **No real email / SMS delivery** | 🟡 medium | Letters are written to `application_letters` and pushed to the student via realtime, but nothing actually emails or SMSes anyone. Students see letters by visiting their portal. | (no notification service) |
| **`application_decisions` not in realtime publication** | 🟢 low (intentional) | Decisions write to `application_decisions` (audit trail) but aren't published. The student-visible event — status flip + new letter + new step — propagates via the `applications` and `application_letters` publications. The audit row itself doesn't need realtime. | `supabase/migrations/0008` |
| **Coordinator inbox doesn't paginate** | 🟢 low | Loads all submitted apps in one query. Fine at hackathon scale; won't scale past ~1000 active. | `app/api/coordinator/inbox/route.ts` |
| **7 moderate npm audit warnings** | 🟢 low | All in transitive deps; no critical or high. `npm audit fix --force` would touch breaking-change versions — left alone for stability. | `package.json` |
| **Limited automated tests** | 🟢 low | One smoke test (`tests/glm-mock.test.ts`) covers the GLM + ILMU mock-mode resilience paths. No integration tests against live DB or full HTTP routes — confidence still comes mostly from manual demo runs. | `tests/` |
| **No rate limiting on public APIs** | 🟢 low | Upstash Redis is configured but only used incidentally. Auth endpoints (Supabase OTP) are protected by Supabase itself, but our custom `/api/*` routes have no rate limit. | `lib/utils/responses.ts` |

---

## 🚧 Production-readiness gaps

Things that would need to be built (not just polished) before this is anything more than a demo.

1. **Email/SMS notifications** — coordinators don't get pinged when an SLA breaches; students don't get emailed when a letter is sent. Realtime push only works for users on the page.

2. **Multi-tenancy** — single-UM hardcode throughout. Faculty list, role list, and SOP catalogue are not parameterised by institution.

3. **Document scanning (OCR)** — image-only PDFs are rejected by `pdf-parse`. The `tesseract.js` dep was added then removed; OCR was scoped out.

4. **Audit immutability** — `application_decisions` and `application_letters` are mutable (no append-only enforcement). For a real student-records system, decisions should be immutable + signed.

5. **Per-faculty access scoping** — a coordinator currently sees the whole inbox regardless of their staff_profile.faculty. Inbox should filter by `procedures.applicable_faculties` overlap.

6. **Letter delivery proofing** — `delivered_to_student_at` is set at insert time, but there's no ACK that the student actually viewed it. Real systems track open-receipts.

7. **Withdraw audit** — students can withdraw, but the `application_decisions` row isn't preserved with the original draft state. Reversibility is one-way.

---

## 🛠 Resilience improvements applied in this review pass

These were tightened during the MVP review (commit `<this commit>`):

- **`/api/applications/[id]/submit`**: if `generateBriefing` throws (rate limit, transient 5xx, key expired), we now write a fallback briefing flagged for coordinator regeneration *and still flip status to `submitted`*. Previously the endpoint returned 502 and orphaned the application.
- **`/api/coordinator/applications/[id]/decide`**: if `fillLetter` throws on approve/reject, the raw template (with placeholders unfilled) is now written as the letter rather than silently emitting nothing. The student sees a letter that needs manual cleanup; previously they saw a status-flip with no letter and no recovery path.
- **`/api/applications/[id]/respond`**: now rejects `final_submit`-typed steps explicitly (`409 — call POST /submit, not /respond`). The frontend already routes correctly; this closes the malicious-direct-call hole.
- **Migrations 0005 backfilled** (`0005_v2_application_tables.sql`): the entire v2 application data model — `applications`, `application_steps`, `application_briefings`, `application_decisions`, `application_letters`, `procedure_letter_templates`, plus the `owns_application` / extended `is_staff` helpers and matching RLS policies — is now codified in version control. Fully idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE` everywhere) so it composes cleanly with existing 0009/0011 migrations on a fresh install. Verified against production: the live DB matches the migration row-for-row.
- **Smoke test added** (`tests/glm-mock.test.ts`): exercises GLM + ILMU mock-fallback paths so future contributors can `npm test` and immediately see whether the resilience layer is intact.
- **Code cleanup**:
  - Removed unused deps `@tisoap/react-flow-smart-edge`, `reactflow`, `tesseract.js` (v1-architecture leftovers).
  - Removed dangling `seed:test` npm script that pointed to a non-existent `scripts/seed-test.ts`.
  - Added `ILMU_API_KEY`, `ILMU_API_BASE_URL`, `USE_ILMU_FOR_BRIEFING` to `.env.example`.

---

## 🟢 Demo readiness checklist

For a 90-second judged demo, these are the things that need to be true:

- [x] All 5 procedures live and clickable from the portal
- [x] Demo data resets on every demo-tile sign-in (so judges never inherit prior state)
- [x] Realtime status updates between student and coordinator (post `0015_realtime_replica_identity.sql`)
- [x] AI briefing renders human-readable labels, not snake_case DB keys
- [x] Coordinator inbox has SLA tags, AI urgency sort, keyboard shortcuts
- [x] Letter preview & edit works with hallucination warnings
- [x] Mock fallback works if Z.AI / ILMU keys aren't configured
- [x] Admin can add a new procedure end-to-end (PDF upload included)
- [x] No dev-mode "Demo mode" banner showing on production (controlled by `GLM_MOCK_MODE`)
- [ ] Pitch-deck slide content finalised (taglines + slides built externally — Canva / Slides / Pitch.app)

---

## Provider routing

| Endpoint | Default provider | When swapped |
|---|---|---|
| Coordinator briefing | Z.AI GLM-4.6 | `ilmu-glm-5.1` if `USE_ILMU_FOR_BRIEFING=true` |
| Step emission, letter fill, intent extract, progress estimate, document parse | Z.AI GLM-4.6 / GLM-4.5-flash | (no swap) |

ILMU was wired in deliberately for the *coordinator briefing only* — that's the call that digests Malay-heavy step history, so the headline BM capability is most directly useful there. The student-facing step emission stays on GLM to avoid regressions in the demo hot path.
