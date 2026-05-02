# UniGuide — 5-Minute Pitch Script

**Team 108 · Breaking Bank · UMHackathon 2026 Final Round**
Deck: `docs/UniGuide Pitch Deck - Team  108.pdf` (14 slides)
Slot: 3 May 2026, 10:00 AM — **10 min present (5 pitch + 5 demo) + 5 min Q&A**.

This script covers the **5-minute pitch only**. The demo follows immediately after — so this script does *not* describe the student/coordinator UI (the demo will show it). The pitch sets up the demo by establishing problem, thesis, and the moats the demo can't show on screen (the regex+judge layers, the sovereign-MY routing).

**Word target:** ~580 words (≈ 4 min 8 s spoken at 140 wpm + ~50 s for transitions, slide changes, and emphasis pauses → lands at 5:00).

**Speaker model:** 2-speaker default. **Jeanette** (S1) opens & closes — Group Leader anchors the narrative. **Teo** (S2) owns the technical-moat slides 4 & 5–6, then runs the demo. An Qi and Thevesh: support on Q&A.

---

## The Script

### [Slide 1 — Title] · 0:00 – 0:20

**[S1]**
Good morning, judges. We're Team 108 — Breaking Bank — and we built **UniGuide**: an AI co-pilot for university paperwork that the coordinator can actually trust to send on their behalf.

---

### [Slide 3 — The Problem] · 0:20 – 1:00

**[S1]**
Picture a UM coordinator on a Monday morning. Two hundred scholarship applications in the inbox, sorted oldest-first. They open the first one — and it's the same mistake they corrected last week. And the week before.

Three pains stack up. SOPs nobody reads. Inboxes triaged by date instead of risk. And decision letters typed by hand — where one wrong CGPA destroys the office's credibility.

---

### [Slide 4 — Solution Overview] · 1:00 – 1:50

**[S2]**
UniGuide is a **planner, not a chatbot**. There's no static form. At every turn, Z.AI's GLM-4.6 reads the official SOP *and* the student's history — and asks for exactly the next thing it needs, one step at a time.

Pull the LLM out, and no application advances past step one. That's the moat: the workflow doesn't exist without the model.

---

### [Slides 5–6 — The Letter Loop] · 1:50 – 3:00

**[S2]**
The hardest moment in any AI workflow is when the system speaks on the user's behalf — when the AI puts the institution's name on a decision letter. That's where most demos break.

So we built three layers, each catching a different failure mode.

GLM-4.6 fills the template. Then a regex hallucination check compares every name, CGPA, faculty, and year against the student's actual record. Then GLM-4.6 runs *again* as a second-layer judge, validating the letter against the SOP — catching the semantic errors the regex can't see.

Coordinator previews, edits, sends. Five-minute undo on regret.

**AI authors. Code verifies. Coordinator decides.** No layer can be skipped.

---

### [Slide 8 — Sovereign-MY] · 3:00 – 3:35

**[S1]**
And we are the only co-pilot in this segment that ships with **sovereign-MY routing on day one**. Coordinator briefings on Bahasa-heavy applications route through ILMU GLM-5.1 — YTL AI Labs and Universiti Malaya's own model.

Why does that matter? Because every application carries IC numbers, family income, EPF history. That data should not leave Malaysia. Malaysia-hosted, Malaysia-trained, MyDigital-aligned.

---

### [Slides 10–11 — Market & Business] · 3:35 – 4:20

**[S1]**
TAM: 1.3 million higher-ed students in Malaysia. SAM: 600,000 public-university students. SOM is UM itself — 42,000 students.

The model is a circular ecosystem. Government provides the data-residency mandate. Universities free coordinators for the edge cases. Students get fair outcomes. ILMU keeps Malaysian student data on Malaysian soil.

---

### [Slide 14 — Conclusion + Demo Handoff] · 4:20 – 5:00

**[S1]**
A generic chatbot can imitate the surface. None of these moats survive imitation — the planner that re-reads the SOP every turn, the regex-plus-judge letter loop, and the sovereign routing layer.

UniGuide is what happens when you stop trying to *replace* the coordinator — and start trying to make them **unstoppable**.

Now Teo will show you what that looks like in flight.

**[hand off to S2 → 5-min live demo]**

---

## Production notes

### Delivery
- **Pace:** ~140 wpm. Slow on the bolded clauses (`AI authors. Code verifies. Coordinator decides.` / `unstoppable`). These are the lines judges will quote back.
- **Pauses:** 1-beat after "the same mistake they corrected last week." Let the absurdity land. 1-beat after "Pull the LLM out, and no application advances past step one." Let the moat land. 1-beat after the bolded "AI authors. Code verifies. Coordinator decides." line — judges need a moment to register the architecture.
- **Don't pre-describe the demo.** The script deliberately skips the student/coordinator UI walkthrough — the demo will show it. If you find yourself describing UI on stage, cut it; let the screens do that work.

### What the demo should cover (separate 5 min, not in this script)
1. Student answers an AI-prompted step → upload a PDF → AI reads it inline.
2. Coordinator opens the briefing → CGPA, EPF-implied income, RAG flags, AI recommendation.
3. Coordinator clicks decide → letter generates → regex check passes → GLM judge passes → preview → send.
4. (If time) Hit undo within 5 min to retract.

### Variations on demand
- **3-minute cut** (elevator): drop slides 8, 10, 11 — keep Problem → Planner → 3-layer loop → Closing.
- **4-speaker split:** S1 opens (slide 1, 3) → S2 owns slide 4 → S3 owns slides 5–6 → S4 owns slide 8 → S1 closes (10–14). Adds ~6 s in handoff overhead.

### Numbers double-check before stage
- "200 corrections per intake" — confirm against the coordinator interview source before quoting on stage.
- TAM/SAM/SOM (1.3M / 600K / 42K) — confirm against the Business Proposal PDF; numbers must match the written deliverable.
- "Five-minute undo" — confirm the implemented window in `app/api/applications/[id]/submit/route.ts`. If different, change the script to match.

### Q&A landmines to prep
- *"What if Z.AI is down?"* → mock-fallback layer, raw template ships, coordinator regenerates. Demo never collapses.
- *"How is this different from a fine-tuned LLM?"* → we don't fine-tune; we re-ground every call against the SOP. Cheaper, audit-friendly, no retraining when SOPs change.
- *"Hallucination on the letter — really zero?"* → no, but the regex layer catches every fact mismatch on fields we know about (name, CGPA, faculty, year, programme). The GLM-4.6 second judge layer catches semantic mismatches the regex can't see. Two orthogonal failure modes.

---

## Rehearsal checklist

1. **Time the pitch alone.** Read aloud with a stopwatch. Target 4:50–5:00. Under 4:30 → slow down on the bolded lines; over 5:10 → cut "And the week before." and trim the market section.
2. **Time the pitch + demo together.** Total must fit in 10:00. If demo runs long, the conclusion line "Now Teo will show you…" can be tightened to "Let me show you" to save 2 s.
3. **Rehearse the S1→S2 handoffs** at slide 4 and slide 14. Each switch costs ~1–2 s in real delivery.
4. **Cross-check against the deck.** Walk through the deck PDF page-by-page with the script open; every slide should have at least one beat in the script.
