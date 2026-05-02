# CLAUDE.md — UniGuide project memory

This file is loaded automatically by Claude Code when working in this project. It captures the canonical context every session needs. Update it when status changes; don't duplicate content already in code or in `docs/`.

---

## Identity

- **Team:** Team Breaking Bank · Team Number **108** · UMHackathon 2026 Domain 1 (AI Systems & Agentic Workflow Automation)
- **Members:** Jeanette Tan En Jie (Group Leader, primary submitter) · Teo Zen Ben (Technical Lead) · Nyow An Qi · Thevesh A/L Chandran
- **Status as of 2026-04-26:** **🏆 FINALIST.** Preliminary round submitted on 26 April 2026. Finalists announced 29 April 2026 11:10 PM. **Final round in progress.**
- **Live demo:** https://uniguide-blush.vercel.app
- **Repo:** https://github.com/ZenBen5173/uniguide

---

## Final round (current phase)

The hackathon is now in the FINAL ROUND. The handbook is at `docs/Hackathon Info/UMHackathon2026 Finalist Handbook.pdf`. Key points all sessions should know:

### Two sub-phases

| Phase | Window | Where |
|---|---|---|
| **Online Sub-Phase** | 29 Apr 2026 11:10 PM – 2 May 2026 7:59 AM | Remote work on deliverables |
| **Physical Sub-Phase** | 2 May 2026 8:00 AM – 3 May 2026 8:00 PM | FCSIT UM (24-hour in-person hackathon → KPS Auditorium for pitching) |

**Final submission deadline:** 3 May 2026 **07:59:59 AM** (via the official portal at umhackathon.com)
**Pitching:** 3 May 2026 10:00 AM, 10 min present + 5 min Q&A, parallel sessions
**Closing & Awards:** 3 May 2026 4:30 PM at KPS Auditorium

### Submission mechanics — important

> "**You will submit one Link (Github Repo) and Include these Deliverables in the First Section of Your Readme for easier access.**" — Finalist Handbook §Rules & Deliverables

So: the README's first section MUST be the deliverables table with file paths / links. Do not move it lower or rename it without preserving that role. The submission form expects only one input — the GitHub repo URL.

### Required deliverables (DIFFERENT from preliminary round)

The preliminary submission was PRD + SAD + QATD + Pitch Deck + Code Repo + 10-min Pitching Video. **The final round drops PRD, SAD, and the video** and replaces them with two new docs (Deployment Plan + Business Proposal). The final five deliverables:

| # | Deliverable | Format | Status |
|---|---|---|---|
| 1 | Code Repository | this repo | ✅ existing |
| 2 | **Refined** Quality Assurance Testing Document | PDF | ⏳ refine `docs/QATD.pdf` |
| 3 | **Deployment Plan** *(new)* | PDF | ⏳ TBD |
| 4 | **Business Proposal** *(new)* | PDF | ⏳ TBD |
| 5 | **Final Round Pitch Deck** *(new content)* | PDF | ⏳ TBD (preliminary deck `docs/UniGuide Pitch Deck - Team  108.pdf` is for reference only) |

### Mandatory branding

> "Your all Deliverables documentation (e.g. Pitch Deck) must include **Z.AI & YTL AI LABS logo**. We will share with you the logo." — Finalist Handbook

Both logos must appear in every deliverable PDF (Pitch Deck, Deployment Plan, Business Proposal, refined QATD). The organizing committee shares the logo files separately.

### Judging criteria (NEW WEIGHTS — different from preliminary)

| Category | Weight |
|---|---|
| Business Proposal & Market Potential | **20%** |
| Deployment Plan & Production Architecture | **20%** |
| Quality Assurance & Reliability Execution | 15% |
| Production Engineering and Code Maturity | 15% |
| Fit, Validation, Feasibility | 15% |
| Final Pitch and Technical Defense | 15% |

Notice the two new categories carry the heaviest weight (40% combined). Effort allocation in the online sub-phase should reflect that — the Deployment Plan PDF and Business Proposal PDF are not "filler docs", they're 40% of the score.

### Code rules

- Build on the **preliminary submission's code** (encouraged). The repo's git history at the moment finalists were announced is the baseline.
- **Pre-developed code from other hackathons / competitions / prior projects is strictly prohibited.** Anything new must be written during the final-round window.
- All public resources used must be cited.

---

## Architecture (unchanged from preliminary)

- Next.js 15 (App Router, RSC) on Vercel `sin1` region
- Supabase Postgres + Realtime + Storage + Auth (sin-adjacent: ap-northeast-2)
- AI: **Z.AI GLM-4.6 / GLM-4.5-flash** primary across all 6 GLM call-sites; **ILMU `ilmu-glm-5.1`** (YTL AI Labs × UM, Malaysia's sovereign LLM) optionally for the coordinator briefing when `USE_ILMU_FOR_BRIEFING=true`
- 6 GLM call-sites in `lib/glm/`: `nextStep`, `generateBriefing`, `fillLetter`, `estimateProgress`, `extractIntent`, `parseDocument`. ILMU mirror at `lib/ilmu/client.ts`.
- 5 live procedures: scholarship_application, postgrad_admission, final_year_project, deferment_of_studies, exam_result_appeal (+ emgs_visa_renewal as Coming-soon)
- 15 numbered SQL migrations (`supabase/migrations/`); `0005_v2_application_tables.sql` was backfilled, `0015_realtime_replica_identity.sql` is latest
- Demo data resets via the "Reset demo data" chip on the login page (`/api/demo/reset`); 7 sample applications spread across 5 procedures (3 Scholarship lifecycle states + 1 each of FYP, Deferment, Postgrad, Exam Appeal). Auto-reset on every sign-in was removed because it wiped cross-role state mid-demo.

---

## Where things live

| Looking for… | File |
|---|---|
| Honest "what works / what doesn't" reference grounded in code | [`docs/MVP_STATUS.md`](docs/MVP_STATUS.md) |
| Submitted preliminary docs (kept for archive) | `docs/PRD.pdf`, `docs/SAD.pdf`, `docs/QATD.pdf`, `docs/UniGuide Pitch Deck - Team  108.pdf` |
| Official UMHackathon source briefs | `docs/Hackathon Info/` (incl. **Finalist Handbook**) |
| Demo flow + auto-reset logic | `app/api/demo/reset/route.ts`, `app/login/page.tsx` |
| Smoke test (mock-mode resilience) | `tests/glm-mock.test.ts` (run via `npm test`) |
| ILMU diagnostic | `npm run probe:ilmu` (script at `scripts/probe-ilmu.ts`) |

---

## Operating principles for sessions in this project

1. **Don't break the live deploy mid-finals.** Vercel rebuilds on every push to `main`. Verify before pushing if the change touches the demo path (login, student flow, coordinator decide).
2. **Demo data resets every demo-tile sign-in.** Don't rely on stale data persisting across sessions; treat the demo accounts as ephemeral.
3. **The README's first section is the deliverables table.** Don't restructure that — it's a UMHackathon submission requirement.
4. **Mock-mode + auto-fallback is load-bearing for the demo.** If a code change touches `lib/glm/client.ts` or `lib/ilmu/client.ts`, run `npm test` (the smoke tests cover the mock paths).
5. **Status changes go in `docs/MVP_STATUS.md`.** Aspirational claims live in the submitted PDFs (PRD/SAD); CLAUDE.md is for facts; MVP_STATUS is for the gap.
6. **Z.AI + YTL AI LABS logos must be on every deliverable PDF** before final submission.
7. **Code must be original to the hackathon window.** No copy-paste from other repos / competitions.
