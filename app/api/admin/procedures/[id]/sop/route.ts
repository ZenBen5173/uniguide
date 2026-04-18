/**
 * POST /api/admin/procedures/[id]/sop
 *
 * Replace the SOP for a procedure. Body: { source_url?, source_text }
 * Wipes existing chunks for the procedure, splits source_text by H2 sections
 * into chunks, inserts. (PDF parsing TBD — for MVP, admin pastes text or
 * provides a URL we fetch and clean.)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const Body = z.object({
  source_url: z.string().url().nullable().optional(),
  source_text: z.string().min(50, "SOP text must be at least 50 characters"),
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

  const chunks = chunkSop(parsed.data.source_text);
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
    indexed_at: new Date().toISOString(),
  });
}
