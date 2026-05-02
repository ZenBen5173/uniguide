/**
 * GET /api/letters/[id]/pdf
 *
 * Streams a real PDF of the letter to the caller — one-click download for
 * students who don't want to fight the browser print dialog. The print page
 * at /letters/[id]/print is still available for in-tab review and Save-as-PDF
 * via the browser.
 *
 * Auth: owner of the application OR staff/admin. Same rule as the print page.
 *
 * Layout choices kept deliberately simple — the AI-generated letter text is
 * the source of truth, so we just need a faithful, official-looking
 * container. UM crimson masthead bar, Reference + date in the corner,
 * recipient block, body, and a delivery footer.
 */

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
// pdfkit is CommonJS without proper ESM defaults — require directly to avoid
// "default is not a constructor" failures on Node-only routes.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await requireUser();
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = getServiceSupabase();
  const { data: letter } = await sb
    .from("application_letters")
    .select(`
      id, letter_type, generated_text, created_at, delivered_to_student_at,
      applications!inner (
        id, user_id, procedure_id,
        procedures (name)
      )
    `)
    .eq("id", id)
    .single();
  if (!letter) {
    return new Response(JSON.stringify({ ok: false, error: "Letter not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = (letter as any).applications;
  const isOwner = app.user_id === user.id;
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isOwner && !isStaff) {
    return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Look up the recipient profile for the recipient block.
  const { data: studentProfile } = await sb
    .from("student_profiles")
    .select("full_name, matric_no, faculty")
    .eq("user_id", app.user_id)
    .maybeSingle();

  const procName = app.procedures?.name ?? app.procedure_id;
  const dateLabel = new Date(letter.delivered_to_student_at ?? letter.created_at).toLocaleDateString(
    "en-MY",
    { day: "numeric", month: "long", year: "numeric" }
  );
  const refCode = `UG-${letter.id.slice(0, 8).toUpperCase()}`;
  const letterTypeLabel = letter.letter_type.replace(/_/g, " ");

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 64, left: 64, right: 64 },
      info: {
        Title: `${procName} - ${letterTypeLabel}`,
        Author: "Universiti Malaya · UniGuide",
        Subject: `Decision letter ${refCode}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Masthead
    doc
      .fontSize(9)
      .fillColor("#A1253A")
      .font("Helvetica-Bold")
      .text("UNIVERSITI MALAYA", { characterSpacing: 1.4 })
      .moveDown(0.2);
    doc
      .fontSize(13)
      .fillColor("#0F141A")
      .font("Helvetica-Bold")
      .text(procName);
    doc
      .fontSize(10)
      .fillColor("#5C6470")
      .font("Helvetica")
      .text(`${capitaliseFirst(letterTypeLabel)} letter`);

    // Reference block (right-aligned, top of page).
    doc.save();
    const refTop = 56;
    doc
      .fontSize(9)
      .fillColor("#5C6470")
      .text("Reference", 350, refTop, { width: 195, align: "right" });
    doc
      .fontSize(10)
      .fillColor("#0F141A")
      .font("Helvetica-Bold")
      .text(refCode, 350, refTop + 12, { width: 195, align: "right" });
    doc
      .fontSize(9)
      .fillColor("#5C6470")
      .font("Helvetica")
      .text(dateLabel, 350, refTop + 30, { width: 195, align: "right" });
    doc.restore();

    // Divider
    doc
      .moveDown(1.2)
      .strokeColor("#E2E5EA")
      .lineWidth(0.7)
      .moveTo(64, doc.y)
      .lineTo(531, doc.y)
      .stroke()
      .moveDown(0.6);

    // ── Recipient
    if (studentProfile) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#0F141A");
      doc.text(studentProfile.full_name);
      doc.font("Helvetica").fontSize(10).fillColor("#5C6470");
      if (studentProfile.matric_no) doc.text(studentProfile.matric_no);
      if (studentProfile.faculty) doc.text(studentProfile.faculty);
      doc.moveDown(0.8);
    }

    // ── Body
    doc.font("Helvetica").fontSize(11).fillColor("#0F141A").lineGap(2);
    // Preserve paragraphing — split by blank lines, add space between blocks.
    const paragraphs = (letter.generated_text ?? "").split(/\n{2,}/);
    paragraphs.forEach((para: string, idx: number) => {
      doc.text(para.trim(), { align: "left" });
      if (idx < paragraphs.length - 1) doc.moveDown(0.6);
    });

    // ── Footer
    doc.moveDown(2);
    doc
      .strokeColor("#E2E5EA")
      .lineWidth(0.7)
      .moveTo(64, doc.y)
      .lineTo(531, doc.y)
      .stroke()
      .moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#5C6470")
      .text(
        `Generated and delivered electronically via UniGuide on ${dateLabel}. Reference ${refCode}. For queries, contact the issuing office through your UniGuide portal.`,
        { align: "left" }
      );

    doc.end();
  });

  const filename = `${procName.replace(/[^a-z0-9]+/gi, "_")}_${letter.letter_type}_${refCode}.pdf`;

  // Convert Node Buffer to a Web-stream-friendly Uint8Array for the Response.
  const body = new Uint8Array(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}

function capitaliseFirst(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
