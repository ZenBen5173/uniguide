# PITCH DECK — UniGuide

**Format:** Markdown outline → drop into Google Slides / Canva / Pitch.
**Slide count:** 12 (preliminary) / extends to 14 with backup
**Time budget:** 10 minutes total — roughly 50 sec per slide
**Companion docs:** [PRD.md](PRD.md), [SAD.md](SAD.md), [QATD.md](QATD.md)

---

## Slide 1 — Title

**UniGuide**
*Your AI co-pilot for university paperwork.*

- **Team:** Breaking Bank — Jeanette Tan En Jie · Teo Zen Ben · Nyow An Qi · Thevesh A/L Chandran
- **Domain:** AI Systems & Agentic Workflow Automation (Domain 1)
- **UMHackathon 2026 — Preliminary Submission**
- **Live demo:** https://uniguide-blush.vercel.app
- **Repo:** https://github.com/ZenBen5173/uniguide

> *Visual:* clean wordmark + a faint background of a stylised flowchart with one branch lighting up.

---

## Slide 2 — The Pain (a real student story)

**Meet Aishah. Year 3, FSKTM. CGPA 3.10. Family income RM 3,500/month.**

She needs financial help to continue her degree. She's heard of "scholarships" but doesn't know where to start.

What she doesn't know:
- Her family is **B40** — she qualifies for **need-based** scholarships (Yayasan UM, MARA if Bumiputera, JPA), not just merit ones
- Her CGPA 3.10 is **below** the standard 3.30 Yayasan UM threshold — but she can apply with a hardship justification
- She's **non-Bumiputera** — MARA is off the table; **PTPTN is a loan, not a scholarship**
- Each scholarship is on a **different portal** with different deadlines, different income-proof formats
- If she misses the window, she's another semester without aid

**She learns each of these the hard way — usually after a friend mentions it in passing.**

> *Visual:* Aishah's "I just need to fill one form" assumption vs. the actual scholarship landscape (10+ options, 5 portals, 4 eligibility filters).

---

## Slide 3 — Aishah is everyone

This is not just scholarships. It's the same shape across every UM procedure:

| Procedure | Hidden trap |
|---|---|
| **Scholarship & Financial Aid** | Eligibility branched by income / CGPA / Bumiputera / level — students apply to the wrong ones and miss the right deadlines |
| **Exam Result Appeal** | 2-week window from result release; per-course non-refundable fee |
| **Deferment of Studies** | Medical cert MUST be from Govt Hospital, not private GP |
| **Postgrad Admission (research)** | You need to find a supervisor *before* applying |
| **EMGS Visa Renewal** | Start 3 months before expiry; ≥80% attendance OR refused |
| **Final Year Project** | Ethics review takes 4–8 weeks if you have human subjects |

**Today: students piece this together from forum threads. Staff triage incomplete forms. Both sides lose.**

> *Visual:* 6 small "iceberg" diagrams — what students see vs. what's underneath.

---

## Slide 4 — UniGuide

**An AI assistant powered by Z.AI's GLM that:**

1. **Picks the right procedure** from a clear catalogue (Scholarship, FYP, Deferment, Exam Appeal, Postgrad, Visa)
2. **Walks the student through it adaptively** — GLM reads the official UM SOP and emits the **next step at runtime, one at a time** (form, file upload, free text, multi-choice). Each step cites the SOP section that drove it.
3. **Pre-digests submissions for staff** — every submission arrives with a GLM briefing: extracted facts, flagged edge cases, recommended decision with reasoning + confidence
4. **Generates the letter** — on Approve / Reject, GLM fills the procedure's letter template against the application; coordinator can preview, edit, and send
5. **Catches its own mistakes** — every letter goes through a hallucination check (wrong CGPA, mismatched name, wrong faculty) before it can be sent
6. **Audits everything** — every GLM call (input, output, latency, tokens, confidence) is logged and surfaced on an Admin → GLM Traces page

> *Visual:* product hero shot — split: student step-stack (left) with citation chips, coordinator briefing + decide panel (right).

---

## Slide 5 — Demo (90-second walkthrough)

**Live demo flow** (pre-recorded backup video plays if live fails):

1. *(0:00)* Land on `uniguide-blush.vercel.app` → **"Try the demo →"** → 3 demo tiles → **Student**
2. *(0:10)* **"Reset Demo Student & sign in"** → portal seeds with **5 sample applications** in different states (mid-flow draft, high-conf approve, low-conf+flagged, approved, rejected)
3. *(0:25)* Click the **draft** → application page → **First-step orientation banner** + step stack with the current AI-emitted step
4. *(0:40)* Click a **citation chip** under the prompt (e.g., **§Document Checklist**) → SOP viewer modal opens, scrolled to that section, term highlighted. *"The AI isn't making this up — here's the source."*
5. *(0:55)* Sign out → **Coordinator** demo tile → inbox sorted by AI urgency
6. *(1:05)* Open the **low-confidence row** (0.42, block flag) → AI Briefing card shows reasoning + flags + extracted facts
7. *(1:20)* Click **AI suggest: request info** → comment box auto-fills with a tailored draft based on the flags. Click **Request more info** → student gets a new step in their flow (realtime, no refresh)
8. *(1:40)* Open the **high-confidence row** (0.92) → click **Preview & approve** → modal shows the GLM-generated letter, **editable**, with the **hallucination check** running. Confirm & send.
9. *(1:55)* Switch to the still-open student tab — **status flipped to Approved instantly**, letter delivered, **Open / Print →** opens a clean printable letter

**Throughout:** GLM traces visible at `/admin/glm-traces` — judges can audit every model decision.

> *Visual:* embedded video. Transcript in speaker notes for the live presenter.

---

## Slide 6 — Architecture (the engine room)

```
Browser (3 role surfaces)
    │
    ├─→ Next.js 15 App Router + ~30 API routes
    │       │
    │       ├─→ GLM Service Layer (lib/glm/*)
    │       │      • nextStep   — emits the next step from SOP + history
    │       │      • generateBriefing — coordinator-side digest
    │       │      • fillLetter — template + facts → letter text
    │       │      • estimateProgress — total step count
    │       │      • suggestComment — drafts coordinator reply
    │       │      → Z.AI GLM (glm-4.6 + glm-4.5-flash)
    │       │
    │       └─→ Supabase
    │              • Postgres + pgvector (KB, applications, audit)
    │              • Storage (application-files bucket, RLS-protected)
    │              • Auth (OTP + demo passwords)
    │              • Realtime (status flips reach client in <1s)
    │
    └─→ Vercel (sin1 region, ~70ms to Supabase Seoul)
```

**Three things judges should notice:**

1. **GLM is a single, encapsulated service layer** — every prompt is a versioned `.md` file, every call is logged with reasoning trace, model version, prompt hash, latency, tokens.
2. **Steps are emitted at runtime, not pre-built** — there is no static workflow template; GLM decides what to ask next based on full history + the indexed SOP. Pull GLM out → no application can advance past step 1.
3. **Citations + hallucination check + GLM trace viewer** are surfaced to users and admins, not buried in logs — transparency is part of the product.

> *Visual:* the architecture diagram from SAD §System Architecture.

---

## Slide 7 — Why GLM is load-bearing (not bolted on)

The hackathon brief: *"If the GLM component is removed, the system should lose its ability to coordinate and execute the workflow effectively."*

**UniGuide passes this test by design.**

| Function | Without GLM | With GLM |
|---|---|---|
| Next-step decision | The application can't advance past step 1 — there's no static template | GLM reads SOP + history → emits the right step type + prompt + citations |
| Coordinator briefing | Raw form dump for the staff to parse | Extracted facts + recommendation + reasoning + flags + confidence |
| Letter generation | Coordinator hand-writes every letter | Template + facts → filled letter, ready to edit and send |
| Suggested comment | Blank box | Pre-drafted comment based on briefing flags + intent |
| Step count estimate | "Unknown" | Estimated total so the student sees how far they are |
| Mock-mode resilience | App breaks if API is down | Auto-fallback to recorded fixtures with logged error — demo never collapses |

**Pull GLM out → UniGuide is unable to plan, advance, brief, or decide on a single application.**

> *Visual:* a "before / after" table — the same coordinator inbox row, with vs. without the GLM-generated briefing.

---

## Slide 8 — The Student Experience

**Three design principles:**

1. **Adaptive, not adaptive-looking.** The UI doesn't shout "AI"; it just answers questions students already had — but with the **"Adaptive"** pill on AI-emitted steps and citation chips so the AI's role is always legible.
2. **Show the road ahead.** Progress strip + estimated steps + ~X min remaining + deadline chip — no scary uncertainty.
3. **Trust through transparency.** Every AI-emitted question shows clickable §SOP-section chips → opens the source SOP modal. The student can audit "why is the AI asking this?" at any moment.

**Plus what the student gets day-to-day:**
- **Auto-save** to localStorage (real, debounced) — close the tab, reopen, draft persists
- **Save & exit** affordance + **Withdraw application** in the footer
- **Revise** any completed step (clears later steps, AI replans)
- **Real-time status updates** — coordinator decides → student sees it instantly, no refresh
- **Messages thread** with the coordinator for ad-hoc questions
- **View Source SOP** modal with full-text search
- **Profile editor** at `/settings/profile` — update CGPA, programme, faculty anytime

> *Visual:* 3 product screenshots — application page with citation chip + SOP modal opening, right rail with Messages, status flipping live.

---

## Slide 9 — The Staff Experience

**The other half of the problem.**

Staff today: triage 200 sloppy submissions a week. Re-read the same incomplete form for the hundredth time.

**Staff with UniGuide — coordinator inbox:**
- AI urgency sort (low confidence + blocking flags surface first)
- Per-row: AI recommendation + plain-English confidence ("Very confident" / "Borderline" / "Review carefully") + flag icons
- **SLA aging** — rows tint amber at 24h, crimson at 40h
- **Bulk approve** (excludes flagged/low-conf automatically) + **Bulk request-info** (one shared message to N students)
- **Drafts tab** — see in-progress applications too, read-only
- **Procedure filter** + **Mine** (claimed-by-me) filter
- **Keyboard nav** — j/k navigate, Enter open, / focus search

**Coordinator detail page:**
- AI Briefing front-and-centre (recommendation + reasoning + extracted facts + flags + confidence)
- **Claim** so other coordinators don't collide on the same row
- **AI suggest** pills next to the comment box (request_info / approve / reject) — drafts a tailored comment from the briefing flags
- **Preview & approve / reject** modal — shows the GLM letter, **editable**, with **hallucination check warnings** (mismatched CGPA, wrong name, unfilled placeholders)
- **Undo decision** within 5 minutes (mm:ss countdown)
- **Internal notes** (staff-only, never shown to student) + **Messages thread** (real-time with student)

**Net effect:** a 30-minute review collapses to 3 minutes for clear cases; the borderline ones still get human judgement, but with the briefing already done.

> *Visual:* coordinator inbox + detail page screenshots.

---

## Slide 10 — Tech & Engineering Decisions Worth Calling Out

| Decision | Why |
|---|---|
| **Z.AI GLM** as sole reasoning model | Mandatory by hackathon rules; long context; tool calling; JSON mode |
| **Model tiering** (`glm-4.6` for nextStep/briefing/fillLetter; `glm-4.5-flash` for suggestComment, estimateProgress) | Holds token budget under RM 0.50/workflow |
| **Step-by-step emission, not upfront workflow planning** | Every step incorporates the prior answer + the SOP — strictly more adaptive than a pre-baked template |
| **pgvector** for SOP retrieval | One managed service for relational + vector data |
| **Versioned prompts in source** | Every system prompt is a `.md` file in `lib/glm/prompts/`, hashed per release — full audit |
| **Reasoning trace per call** | Every GLM call stored with model version, prompt hash, latency, tokens, confidence, output → surfaced on `/admin/glm-traces` |
| **Citation surfacing to user** | AI's cited SOP sections shown as clickable chips — kills the hallucination story |
| **Hallucination check on letters** | Regex check after fillLetter compares mentioned CGPA/name/year/faculty/programme against application; flags mismatches in preview before send |
| **Auto-fallback to fixtures** | Real GLM call failure → returns matching mock fixture with logged error → demo never collapses |
| **Realtime via Supabase publication** | `applications`, `application_steps`, `application_letters`, `application_messages` all publish; status flips reach client in <1s |
| **Vercel pinned to `sin1`** | ~70ms RTT to Supabase ap-northeast-2 (Seoul) instead of 200ms+ from US-East |

> *Visual:* table; or 6 small icons each with a one-line caption.

---

## Slide 11 — What's Beyond the Hackathon

**Hackathon MVP (shipped):**
- Scholarship & Financial Aid procedure end-to-end (from intent through coordinator decision)
- 3 fully-realised role surfaces: Student / Coordinator / Admin
- 5 GLM service endpoints, each versioned and traced
- 14 database migrations including realtime + storage + RLS

**Production roadmap:**
- **OCR for scanned PDFs** — current pdf-parse rejects image-only SOPs (~30% of UM corpus)
- **Server-side PDF generation** for letters (currently browser-print)
- **Email delivery** via SMTP — letters are generated but not emailed yet
- **Bahasa Melayu UI** — currently English only
- **Deeper procedure coverage** — Postgrad / FYP / Deferment / Visa / Appeal each need their own SOPs indexed
- **Real MAYA / SiswaMail / SPeCTRUM / EMGS API integrations**
- **Faculty admin self-service** — re-index SOPs as regulations change
- **Cross-procedure deadline awareness** — visa lapsing during thesis defence

**Bigger vision:** every Malaysian government / regulatory procedure (SSM, LHDN e-Invoice, EPF, Halal cert) has the same shape. UniGuide's engine generalises.

> *Visual:* phased roadmap — Now / Next / Later.

---

## Slide 12 — Ask & Contact

**We're asking judges to:**
- Recognise UniGuide as a load-bearing GLM application — every layer of the product needs the model to function (nextStep, briefing, letter, suggestComment all GLM-driven)
- Notice the engineering depth: versioned prompts, citation surfacing, hallucination check, full reasoning trace, realtime updates, RLS-secured storage, undo with 5-min window, demo seeded with 5 varied states
- Notice the transparency: students see citations on every AI question; admins see every GLM call on `/admin/glm-traces`
- Picture the impact: thousands of UM students per year stop missing silent deadlines

**Team:** Breaking Bank — Jeanette Tan En Jie · Teo Zen Ben · Nyow An Qi · Thevesh A/L Chandran
**Repo:** https://github.com/ZenBen5173/uniguide
**Live demo:** https://uniguide-blush.vercel.app
**Quick login:** Three demo tiles on `/login` — Student / Coordinator / Admin (zero credentials needed)

> *Visual:* big QR code linking to live demo. Team photo.

---

## Speaker Notes & Pacing

| Slide | Time | Key talking point |
|---|---|---|
| 1 | 0:30 | Introduce team, domain. Hook: "Every UM student has lost a week to paperwork they didn't understand." |
| 2 | 1:00 | Tell Aishah's story specifically. Use real form numbers / real income tier (B40 = below RM 4,850 per DOSM 2026). |
| 3 | 0:45 | Quickly show the pattern is universal across 6 procedures. |
| 4 | 1:00 | Six product capabilities, fast. Emphasise "step-by-step at runtime" — not pre-baked. |
| 5 | 2:00 | Live demo. **This is the heart** — show the demo seed + the citation-chip → SOP modal moment + the AI-suggest button + the hallucination check. |
| 6 | 1:00 | Architecture. Hit the three things judges should notice. |
| 7 | 1:00 | Address the hackathon brief explicitly with the load-bearing table. |
| 8 | 0:45 | Student experience — 3 principles + day-to-day list. |
| 9 | 0:45 | Staff experience — inbox sort, bulk actions, AI suggest, preview-and-edit. |
| 10 | 0:45 | Engineering depth, fast. Highlight versioned prompts + auto-fallback + realtime. |
| 11 | 0:30 | Roadmap: what's missing on purpose vs. what's next. |
| 12 | 0:30 | Ask, contact, end clean. |
| **Total** | **~10:00** | |

## Backup Slides (if final round goes deeper)

- **Database schema** — 14 tables, ERD from SAD
- **Sample reasoning trace** — raw JSON from `glm_reasoning_trace` for one nextStep call
- **Token cost analysis** — actual measured tokens per workflow stage
- **Failure mode walkthrough** — what happens when GLM 503s (auto-fallback path)
- **RLS policies** — how `application-files` storage bucket prevents student A reading student B's documents

---

**End of Pitch Deck v2.0 — synced with shipped state as of 2026-04-20**
