/**
 * POST /api/admin/procedures/[id]/sop
 *
 * Replace the SOP for a procedure. Body: { source_url?, source_text }
 *
 * Pipeline:
 *  1. AI structures the raw text into clean markdown with `## H2` sections
 *     (structureSop). Catches the common case where a PDF/DOCX extraction
 *     came back as one wall of text without explicit headers — without this
 *     step, the chunker below would emit ONE giant chunk and citations
 *     would be useless.
 *  2. On AI failure (slow/down/rate-limited), fall back to the raw text.
 *  3. Chunk by `## H2` + 400-word boundary.
 *  4. Wipe existing chunks for this procedure and insert the new ones.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { structureSop } from "@/lib/glm/structureSop";
import { apiError, apiSuccess } from "@/lib/utils/responses";

export const runtime = "nodejs";
// structureSop is a single GLM call. Z.AI under load: 30-60s. Mirror the
// student/coordinator routes' ceiling so the structure step doesn't get
// killed mid-call.
export const maxDuration = 60;

const Body = z.object({
  source_url: z.string().url().nullable().optional(),
  source_text: z.string().min(50, "SOP text must be at least 50 characters"),
  /** When false, skip AI structuring and chunk source_text as-is. Default
   *  true. Useful when the admin has pasted pre-structured markdown and
   *  wants a deterministic save without burning a GLM call. */
  ai_structure: z.boolean().default(true),
});

interface Chunk {
  section: string | null;
  content: string;
}

function chunkSop(text: string, maxWords = 400): Chunk[] {
  const lines = text.split(/\r?\n/);
  const chunks: Chunk[] = [];
  let currentSection: string | null = null;
  let buffer: string[] = [];
  let wordCount = 0;

  const flush = () => {
    if (buffer.length > 0) {
      const content = buffer.join("\n").trim();
      if (content.length > 0) chunks.push({ section: currentSection, content });
      buffer = [];
      wordCount = 0;
    }
  };

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)$/);
    if (headerMatch) {
      flush();
      currentSection = headerMatch[1].trim();
      continue;
    }
    // Skip H1 (title)
    if (line.startsWith("# ")) continue;
    buffer.push(line);
    wordCount += line.split(/\s+/).filter(Boolean).length;
    if (wordCount >= maxWords) flush();
  }
  flush();
  return chunks;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin");
  if (!user) return apiError("Admin only", 403);

  const { id: procedureId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.message, 400);

  const sb = getServiceSupabase();

  // Verify procedure exists.
  const { data: procedure } = await sb
    .from("procedures")
    .select("id")
    .eq("id", procedureId)
    .single();
  if (!procedure) return apiError("Procedure not found", 404);

  // ── AI structuring ────────────────────────────────────────────────────────
  // Try to convert the raw text into well-structured markdown with `## H2`
  // section headers so the chunker can split meaningfully. Failures here are
  // non-fatal — fall back to the raw text and the chunker treats it as one
  // long block (still better than failing the save).
  let structuredText = parsed.data.source_text;
  let aiStructured = false;
  if (parsed.data.ai_structure) {
    try {
      const result = await structureSop(
        { rawText: parsed.data.source_text },
        { procedureId }
      );
      structuredText = result.markdown;
      aiStructured = true;
    } catch (err) {
      console.warn(
        "[sop] AI structuring failed, falling back to raw text:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const chunks = chunkSop(structuredText);
  if (chunks.length === 0) return apiError("No content extracted from SOP text", 400);

  // Wipe existing + insert fresh.
  await sb.from("procedure_sop_chunks").delete().eq("procedure_id", procedureId);

  const rows = chunks.map((c, i) => ({
    procedure_id: procedureId,
    chunk_order: i,
    section: c.section,
    content: c.content,
    source_url: parsed.data.source_url ?? null,
  }));

  const { error: insErr } = await sb.from("procedure_sop_chunks").insert(rows);
  if (insErr) return apiError(`Failed to insert chunks: ${insErr.message}`, 500);

  // Update procedure metadata
  await sb
    .from("procedures")
    .update({
      source_url: parsed.data.source_url ?? null,
      indexed_at: new Date().toISOString(),
    })
    .eq("id", procedureId);

  return apiSuccess({
    procedure_id: procedureId,
    chunks_inserted: rows.length,
    ai_structured: aiStructured,
    indexed_at: new Date().toISOString(),
  });
}
