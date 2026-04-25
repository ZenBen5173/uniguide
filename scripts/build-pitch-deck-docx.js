/**
 * Build docs/PITCH_DECK_SLIDES.docx — clean black-and-white deck content.
 *
 * One-shot generator; run via:
 *   node scripts/build-pitch-deck-docx.js
 *
 * Requires the global docx package (npm i -g docx) since the project doesn't
 * pull `docx` as a runtime dep. The output (.docx) is intentionally NOT
 * committed to git — regenerate before each iteration.
 *
 * EDITABLE: the tagline on Slide 1 is still a placeholder (currently
 * "STOP GUESSING. START GRADUATING.") that the team is finalising for the
 * UM-marketing audience. Update Slide 1's tagline string below before the
 * final deck export. Other slide content tracks the shipped state as of
 * 2026-04-25.
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType, ShadingType,
  PageBreak, PageOrientation,
} = require("docx");

// ── helpers ──────────────────────────────────────────────────────────────────
const P = (text, opts = {}) =>
  new Paragraph({ children: [new TextRun({ text, ...opts })], ...opts.pOpts });

const H1 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text, bold: true })] });

const H2 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text, bold: true })], pageBreakBefore: false });

const SPACER = () => new Paragraph({ children: [new TextRun("")] });

const BULLET = (text) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun(text)],
  });

const BULLET_RICH = (runs) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: runs });

const LABEL_BODY = (label, body) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: " " + body }),
    ],
  });

const QUOTE = (text) =>
  new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text, italics: true })],
    spacing: { before: 80, after: 80 },
  });

// Simple 2-col bordered table for "Two columns" slides.
const border = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const CELL_MARGINS = { top: 120, bottom: 120, left: 160, right: 160 };

const TOTAL_W = 9360; // US-Letter content width, 1in margins

function twoColTable(leftHeader, leftBody, rightHeader, rightBody) {
  const colW = Math.floor(TOTAL_W / 2);
  const cell = (headerText, bodyParas, w) =>
    new TableCell({
      borders: cellBorders,
      width: { size: w, type: WidthType.DXA },
      margins: CELL_MARGINS,
      children: [
        new Paragraph({ children: [new TextRun({ text: headerText, bold: true })] }),
        ...bodyParas,
      ],
    });

  return new Table({
    width: { size: TOTAL_W, type: WidthType.DXA },
    columnWidths: [colW, TOTAL_W - colW],
    rows: [
      new TableRow({
        children: [
          cell(leftHeader, leftBody, colW),
          cell(rightHeader, rightBody, TOTAL_W - colW),
        ],
      }),
    ],
  });
}

function threeColTable(h1, b1, h2, b2, h3, b3) {
  const colW = Math.floor(TOTAL_W / 3);
  const cell = (headerText, bodyParas, w) =>
    new TableCell({
      borders: cellBorders,
      width: { size: w, type: WidthType.DXA },
      margins: CELL_MARGINS,
      children: [
        new Paragraph({ children: [new TextRun({ text: headerText, bold: true })] }),
        ...bodyParas,
      ],
    });

  return new Table({
    width: { size: TOTAL_W, type: WidthType.DXA },
    columnWidths: [colW, colW, TOTAL_W - 2 * colW],
    rows: [
      new TableRow({
        children: [
          cell(h1, b1, colW),
          cell(h2, b2, colW),
          cell(h3, b3, TOTAL_W - 2 * colW),
        ],
      }),
    ],
  });
}

// Key-value table (Layer | Tech)
function kvTable(pairs, leftW = 2800) {
  const rightW = TOTAL_W - leftW;
  const cell = (text, w, bold = false) =>
    new TableCell({
      borders: cellBorders,
      width: { size: w, type: WidthType.DXA },
      margins: CELL_MARGINS,
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [cell("Layer", leftW, true), cell("Tech", rightW, true)],
  });

  const rows = pairs.map(
    ([k, v]) => new TableRow({ children: [cell(k, leftW), cell(v, rightW)] })
  );

  return new Table({
    width: { size: TOTAL_W, type: WidthType.DXA },
    columnWidths: [leftW, rightW],
    rows: [headerRow, ...rows],
  });
}

// Generic N-column table with header row + data rows (bold one row by label).
function gridTable(headers, rows, boldLabel = null) {
  const n = headers.length;
  const colW = Math.floor(TOTAL_W / n);
  const widths = Array(n - 1).fill(colW);
  widths.push(TOTAL_W - colW * (n - 1));

  const cell = (text, w, bold = false) =>
    new TableCell({
      borders: cellBorders,
      width: { size: w, type: WidthType.DXA },
      margins: CELL_MARGINS,
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, widths[i], true)),
  });

  const dataRows = rows.map((r) => {
    const isBold = boldLabel && r[0] === boldLabel;
    return new TableRow({
      children: r.map((v, i) => cell(String(v), widths[i], isBold)),
    });
  });

  return new Table({
    width: { size: TOTAL_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

// ── content ──────────────────────────────────────────────────────────────────
const children = [];

// Document title
children.push(H1("UniGuide — Pitch Deck Slide Content"));
children.push(P("13-slide structure · UMHackathon 2026 · Domain 1", { italics: true }));
children.push(SPACER());

// ── Slide 1 ──
children.push(H2("Slide 1 — Cover"));
children.push(P("Team Matcha Latte · Jeanette Tan En Jie · Teo Zen Ben"));
children.push(
  new Paragraph({
    children: [
      new TextRun({ text: "Tagline: ", bold: true }),
      new TextRun({ text: "“STOP GUESSING. START GRADUATING.”" }),
    ],
  })
);
children.push(P("UMHackathon 2026 · Domain 1"));
children.push(SPACER());

// ── Slide 2 ──
children.push(H2("Slide 2 — The Problem"));
children.push(QUOTE("“The 33,000 UM students buried under bureaucracy”"));
children.push(BULLET("SOPs scattered across faculty PDFs, portals, and word-of-mouth"));
children.push(BULLET("Every procedure has a different flow — scholarship, FYP, deferment feel like three different universities"));
children.push(BULLET("Coordinators drown in inbox triage — half of every email is “what do I do next?”"));
children.push(BULLET("No continuity — students re-explain themselves to every officer, every step"));
children.push(SPACER());

// ── Slide 3 ──
children.push(H2("Slide 3 — Challenges"));
children.push(
  twoColTable(
    "Challenge 1",
    [P("Students navigating opaque procedures → AI-guided applications")],
    "Challenge 2",
    [P("Staff deciding fairly under load → Pre-digested briefings")]
  )
);
children.push(SPACER());

// ── Slide 4 ──
children.push(H2("Slide 4 — Solution Overview"));
children.push(
  P("An AI workflow platform that turns every UM procedure into a guided conversation — for students, coordinators, and admins.")
);
children.push(
  new Paragraph({
    children: [
      new TextRun({ text: "Key line: ", bold: true }),
      new TextRun({ text: "“Not a form. An AI agent that asks, gathers, checks, decides.”", italics: true }),
    ],
  })
);
children.push(P("Six pillar boxes:", { bold: true }));
children.push(BULLET("AI step emission"));
children.push(BULLET("SOP citations"));
children.push(BULLET("Pre-digested briefing"));
children.push(BULLET("Hallucination-checked letters"));
children.push(BULLET("Realtime decisions"));
children.push(BULLET("Sovereign MY AI (ILMU)"));
children.push(SPACER());

// ── Slide 5 ──
children.push(H2("Slide 5 — Key Features"));
children.push(
  threeColTable(
    "AI Step Emission",
    [P("GLM reads the SOP + student’s history, generates the next question dynamically. Never a hardcoded form.")],
    "Pre-digested Briefing",
    [P("Coordinator opens an application; sees extracted facts (CGPA, income tier, EPF-implied income), red/amber/green flags, AI recommendation with confidence — not raw text.")],
    "Hallucination-checked Letters",
    [P("AI drafts acceptance/rejection/request-info letters; regex checks every placeholder filled + every fact matches the profile. Coordinator previews and edits before send.")]
  )
);
children.push(SPACER());

// ── Slide 6 ──
children.push(H2("Slide 6 — Solution Architecture"));
children.push(
  kvTable([
    ["Frontend", "Next.js 15 (App Router) + React Server Components"],
    ["Styling", "Tailwind + custom UM design tokens"],
    ["AI · Primary", "Z.AI GLM-4.6 + GLM-4.5-flash"],
    ["AI · Sovereign", "ILMU ilmu-glm-5.1 (YTL AI Labs × Universiti Malaya)"],
    ["AI Orchestration", "OpenAI-compatible SDK · mock-fallback layer"],
    ["Hosting", "Vercel · sin1 region"],
    ["Database", "Supabase Postgres · Realtime · Storage"],
    ["Auth", "Supabase SSR cookies"],
    ["Observability", "/admin/glm-traces — every AI call logged with latency, tokens, confidence"],
  ])
);
children.push(SPACER());

// ── Slide 7 ──
children.push(H2("Slide 7 — Solution Design"));
children.push(
  P("UI mockup screenshot #1 — Student application page (AI asks the next step, §section citations beneath the prompt, right rail shows “What I’ve shared”).")
);
children.push(P("[UI MOCKUP — Student Application Page]", { bold: true }));
children.push(SPACER());

// ── Slide 8 ──
children.push(H2("Slide 8 — Solution Design"));
children.push(
  P("UI mockup screenshot #2 — Coordinator inbox + decide panel (SLA-aware table with AI urgency sort, briefing pre-loaded with extracted facts + flags, preview-letter modal with hallucination warnings).")
);
children.push(P("[UI MOCKUP — Coordinator Inbox + Decide Panel]", { bold: true }));
children.push(SPACER());

// ── Slide 9 ──
children.push(H2("Slide 9 — Business Model"));
children.push(
  twoColTable(
    "For Universities",
    [P("Free pilot (1 faculty, 6 months) + Institution tier (RM 3 per student per year)")],
    "Revenue Streams",
    [
      P("University SaaS licenses"),
      P("MyDigital / JPA digital-transformation grants"),
      P("Analytics add-on (procedure-level throughput + cycle-time dashboards)"),
    ]
  )
);
children.push(SPACER());

// ── Slide 10 ──
children.push(H2("Slide 10 — Circular Ecosystem"));
children.push(P("Four nodes connected in a circle:"));
children.push(BULLET("Government (MyDigital grant, data-residency mandate)"));
children.push(BULLET("UniGuide (MY-hosted, MY-trained platform)"));
children.push(BULLET("Students (guided applications, fair outcomes)"));
children.push(BULLET("Universities & Sovereign AI (coordinators freed for edge cases, ILMU keeps MY student data MY-resident)"));
children.push(P("→ back to Government", { italics: true }));
children.push(SPACER());

// ── Slide 11 ──
children.push(H2("Slide 11 — Financial Breakdown"));
children.push(P("7-year projection — Year 1 / 3 / 5 / 7"));
children.push(
  gridTable(
    ["Metric", "Y1", "Y3", "Y5", "Y7"],
    [
      ["Active Institutions", "1 (UM pilot)", "5", "20", "40+ (incl. SEA)"],
      ["Active Students", "33K", "200K", "800K", "2M"],
      ["Licensing Revenue", "RM 50K", "RM 500K", "RM 3M", "RM 8M"],
      ["Government Grants", "RM 100K", "RM 300K", "RM 500K", "RM 800K"],
      ["Hosting + AI + DB", "RM 80K", "RM 200K", "RM 900K", "RM 2M"],
      ["Staff Salary", "RM 150K", "RM 400K", "RM 1.2M", "RM 3M"],
      ["Marketing", "RM 10K", "RM 50K", "RM 150K", "RM 400K"],
      ["Legal", "RM 10K", "RM 20K", "RM 50K", "RM 120K"],
      ["Total Cost", "RM 250K", "RM 670K", "RM 2.3M", "RM 5.5M"],
      ["Profit / Loss", "-RM 100K", "+RM 130K", "+RM 1.2M", "+RM 3.3M"],
    ],
    "Profit / Loss"
  )
);
children.push(
  new Paragraph({
    children: [
      new TextRun({ text: "Hockey stick: ", bold: true }),
      new TextRun({ text: "-RM 100K → +RM 130K → +RM 1.2M → +RM 3.3M" }),
    ],
  })
);
children.push(SPACER());

// ── Slide 12 ──
children.push(H2("Slide 12 — Market Size"));
children.push(P("Three concentric circles:"));
children.push(LABEL_BODY("TAM:", "1.3M higher-ed students in Malaysia (all public + private institutions)"));
children.push(LABEL_BODY("SAM:", "600K public-university students (20 public universities — UM, UKM, USM, UPM, UiTM, UTM, UMS, etc.)"));
children.push(LABEL_BODY("SOM:", "33K UM students (flagship pilot — FSKTM + FBE first, then faculty-by-faculty expansion)"));
children.push(SPACER());

// ── Slide 13 ──
children.push(H2("Slide 13 — Conclusion"));
children.push(
  twoColTable(
    "AI Workflow Assistant",
    [
      P("Step emission"),
      P("SOP citations"),
      P("Pre-digested briefings"),
      P("Hallucination-checked letters"),
      P("Realtime decisions"),
      P("Built on Malaysian sovereign AI (ILMU)"),
    ],
    "Sustainable Impact",
    [
      P("Student equity (no more “knew-someone” navigation)"),
      P("Staff efficiency (coordinators focus on edge cases, not triage)"),
      P("Digital sovereignty (MY student data on MY AI infrastructure)"),
    ]
  )
);
children.push(SPACER());

// Footer note
children.push(
  new Paragraph({
    children: [
      new TextRun({ text: "Story arc: ", bold: true }),
      new TextRun({
        text: "Hook → Problem → Challenge → Solution → Features → Tech → Design → Model → Ecosystem → Finance → Market → Impact.",
        italics: true,
      }),
    ],
  })
);

// ── build ────────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 22 } } }, // 11pt body
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Calibri" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Calibri" },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    },
  ],
});

const outPath = path.join(process.cwd(), "docs", "PITCH_DECK_SLIDES.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log(`wrote ${outPath} (${buf.length} bytes)`);
});
