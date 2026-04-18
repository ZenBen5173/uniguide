# PITCH DECK — UniGuide

**Format:** Markdown outline → drop into Google Slides / Canva / Pitch.
**Slide count:** 12 (preliminary) / can extend to 14 for final round
**Time budget:** 10 minutes total (preliminary recording) — roughly 50 sec per slide
**Companion docs:** [PRD.md](PRD.md), [SAD.md](SAD.md), [QATD.md](QATD.md)

---

## Slide 1 — Title

**UniGuide**
*Your AI co-pilot for university paperwork.*

- **Team:** Breaking Bank — Jeanette Tan En Jie · Teo Zen Ben · Nyow An Qi · Thevesh A/L Chandran
- **Domain:** AI Systems & Agentic Workflow Automation (Domain 1)
- **UMHackathon 2026 — Preliminary Submission**

> *Visual:* clean wordmark + a faint background of a stylised flowchart with one branch lighting up.

---

## Slide 2 — The Pain (a real student story)

**Meet Ahmad. Year 3, FSKTM. CGPA 3.10.**

He needs to apply for industrial training next semester. He thinks he just fills a form.

What he doesn't know:
- His CGPA is below the FSKTM 3.30 floor → he needs a faculty appeal *first*
- His placement is at his uncle's company → blocked under conflict-of-interest rules
- He has 48 hours after coordinator approval to react, then 2 weeks to submit form **UM-PT01-PK01-BR074-S00**
- If he misses the registration window, he loses the semester

**He learns each of these the hard way.**

> *Visual:* Ahmad's "happy path" assumption vs. the actual procedure tree (12 stages, 4 decision points). One leads to internship; the other to wasted months.

---

## Slide 3 — Ahmad is everyone

This is not just industrial training. It's:

| Procedure | Hidden trap |
|---|---|
| **Exam grade appeal** | 2-week window from result release; per-course non-refundable fee |
| **Deferment of studies** | Medical cert MUST be from Govt Hospital, not private GP |
| **Postgrad admission (research)** | You need to find a supervisor *before* applying |
| **EMGS visa renewal** | Start 3 months before expiry; ≥80% attendance OR refused |
| **Final Year Project** | Ethics review takes 4–8 weeks if you have human subjects |

**Today: students piece this together from forum threads. Staff triage incomplete forms. Both sides lose.**

> *Visual:* 5 small "iceberg" diagrams — what students see vs. what's underneath.

---

## Slide 4 — UniGuide

**An AI assistant powered by Z.AI's GLM that:**

1. **Reads your situation** in plain English — *"i need internship next sem, cgpa 3.1, uncle's company"*
2. **Plans your personalised workflow** from the official UM SOP — rendered as a visual canvas
3. **Walks you through it adaptively** — rewords each question, parses your uploads, catches the gotchas
4. **Routes intelligently** at every decision point — reasons over what you said, not regex matches
5. **Hands you the deliverables** at the end — filled official PDF, draft emails, deadline calendar, action checklist

And on the other side:
6. **Pre-digests submissions for staff** — extracted facts, flagged edge cases, recommended decision with reasoning trace

> *Visual:* product hero shot — split screen: chat intake (left), generated canvas (right).

---

## Slide 5 — Demo (90-second walkthrough)

**Pre-recorded backup video plays here if live fails.** Live walkthrough:

1. *(0:00)* Type intent → GLM understands → confirms procedure
2. *(0:15)* Canvas renders with Ahmad's personalised flow — CGPA-appeal branch already inserted
3. *(0:30)* Click first stage → adaptive question references Ahmad's CGPA
4. *(0:45)* Upload offer letter PDF → GLM extracts company, dates, role
5. *(1:00)* Reach family-owned-company decision → GLM reasons over Ahmad's free-text answer → flags conflict, suggests alternative
6. *(1:15)* Submit → switch to coordinator view → briefing arrives with extracted facts + recommendation
7. *(1:30)* Coordinator clicks Approve → student gets PDF, emails, calendar instantly

> *Visual:* embedded video. Transcript in speaker notes for the live presenter.

---

## Slide 6 — Architecture (the engine room)

```
Browser → Next.js API → GLM Service Layer → Z.AI GLM
                ↓
         Supabase (Postgres + pgvector + Storage)
```

**Three things judges should notice:**

1. **GLM is a single, encapsulated service layer** (`lib/glm/`) — not sprinkled across the codebase. Every prompt is versioned. Every call is logged with reasoning trace.
2. **pgvector retrieval** brings the right SOP chunks into the GLM context — judges can audit what the model "knew" at every decision.
3. **Atomic stage advancement** via Postgres transactions — workflows never get stuck in a half-state.

> *Visual:* the dependency diagram from SAD §System Architecture (Mermaid render exported as PNG).

---

## Slide 7 — Why GLM is load-bearing (not bolted on)

The hackathon brief: *"If the GLM component is removed, the system should lose its ability to coordinate and execute the workflow effectively."*

**UniGuide passes this test by design.**

| Function | Without GLM | With GLM |
|---|---|---|
| Intent extraction | "Please pick a procedure from the dropdown" | "I see you need industrial training" |
| Workflow planning | No workflow exists for this user | Personalised plan from SOP + profile |
| Question phrasing | Static form labels | Context-aware, conversational |
| Decision routing | Regex over form fields | Reasons over response content with confidence |
| Failure recovery | Email support, wait | GLM drafts your chase email, suggests escalation |
| Admin briefing | Raw form dump | Extracted facts + recommendation + reasoning |

**Pull GLM out → UniGuide collapses to a static form filler.**

> *Visual:* a "before / after" toggle — a screenshot of the static form vs. the GLM-driven UniGuide.

---

## Slide 8 — The Student Experience

**3 design principles:**

1. **Adaptive, not adaptive-looking.** The UI doesn't shout "AI"; it just answers questions students already had.
2. **Show the road ahead.** The canvas means the student always sees the full procedure — no scary uncertainty.
3. **Hand them artefacts they can act on.** Every workflow ends with a downloadable PDF + email drafts + calendar — not "go figure it out."

> *Visual:* 3 product screenshots — chat intake, canvas mid-flow, final outputs panel.

---

## Slide 9 — The Staff Experience

**The other half of the problem.**

Staff today: triage 200 sloppy submissions a week. Re-read the same incomplete form for the hundredth time.

**Staff with UniGuide:** open the dashboard → each pending review is a one-page GLM briefing:

> *"Ahmad bin Ali — Industrial Training. CGPA 3.10 (below 3.30 floor; appeal letter attached). Company: TechCorp Sdn Bhd (verified in CoR). Family-owned: No (clarified after disambiguation). Confirmation form deadline: 15 May. Recommendation: Approve with conditional appeal acceptance. Reasoning: ..."*

**One click: Approve / Reject / Request More Info.**

> *Visual:* coordinator dashboard screenshot.

---

## Slide 10 — Tech & Engineering Decisions Worth Calling Out

| Decision | Why |
|---|---|
| **Z.AI GLM** as sole reasoning model | Mandatory by hackathon rules; long context; tool calling; JSON mode |
| **Model tiering** (`glm-4.6` for planning/routing; `glm-4.5-flash` for high-volume) | Holds token budget under RM 0.50/workflow |
| **pgvector** for SOP retrieval | One managed service for relational + vector data |
| **Versioned prompts in source** | Every system prompt is a `.md` file, hashed per release — full audit |
| **Reasoning trace per decision** | Every GLM output stored with model version, prompt hash, latency, tokens |
| **Citation verification** | No regulation reference shown to user unless verified in KB → kills hallucinated citations |
| **No fallback to non-GLM logic** | Deliberate — if GLM is down, workflow halts gracefully (per hackathon brief) |

> *Visual:* table; or 6 small icons each with a one-line caption.

---

## Slide 11 — What's Beyond the Hackathon

**Hackathon MVP:** Industrial Training (deep) + Postgrad Admission (shallow). Single-tenant. Mocked integrations.

**Production roadmap:**
- Real MAYA / SiswaMail / SPeCTRUM / EMGS API integrations
- Bahasa Melayu UI
- Voice intake
- Faculty admin self-service: re-index SOPs as regulations change
- Cross-procedure deadline awareness (visa lapsing during thesis defence)
- Expand to other Malaysian public universities (USM, UKM, UPM, UTM) — same engine, different KB

**Bigger vision:** every Malaysian government / regulatory procedure (SSM, LHDN e-Invoice, EPF, Halal cert) has the same shape. UniGuide's engine generalises.

> *Visual:* phased roadmap — Now / Next / Later.

---

## Slide 12 — Ask & Contact

**We're asking judges to:**
- Recognise UniGuide as a load-bearing GLM application — every layer of the product needs the model to function
- Notice the engineering depth: versioned prompts, citation verification, atomic stage advancement, full reasoning trace
- Picture the impact: thousands of UM students per year stop missing silent deadlines

**Team:** [TBD names + roles]
**Repo:** [TBD GitHub URL]
**Live demo:** [TBD Vercel URL]
**Contact:** [TBD team email]

> *Visual:* big QR code linking to live demo. Team photo.

---

## Speaker Notes & Pacing (for whoever records the video)

| Slide | Time | Key talking point |
|---|---|---|
| 1 | 0:30 | Introduce team, domain. Hook: "Every UM student has lost a week to paperwork they didn't understand." |
| 2 | 1:00 | Tell Ahmad's story specifically. Use real form numbers. |
| 3 | 0:45 | Quickly show the pattern is universal. |
| 4 | 1:00 | Six product capabilities, fast. |
| 5 | 2:00 | Live demo or pre-recorded video. **This is the heart.** |
| 6 | 1:00 | Architecture, hit the three things judges should notice. |
| 7 | 1:00 | Address the hackathon brief explicitly. |
| 8 | 0:45 | Student experience — 3 principles. |
| 9 | 0:45 | Staff experience — the other half. |
| 10 | 0:45 | Engineering depth, fast. |
| 11 | 0:30 | Roadmap, brief. |
| 12 | 0:30 | Ask, contact, end clean. |
| **Total** | **~10:00** | |

## Backup Slides (if final round goes deeper)

- Detailed schema (ERD from SAD)
- Sample reasoning trace for a decision node (raw JSON)
- Token cost analysis (charts)
- Failure mode walkthrough (TC-12 in action)
- Prompt-injection defence demo (ADV-01)

---

**End of Pitch Deck Outline v1.0**
