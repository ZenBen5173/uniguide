/**
 * Seed the knowledge base from lib/kb/seed/*.md.
 *
 * Reads each markdown file, splits into chunks (~500 words), and inserts into
 * procedure_sop_chunks. Embeddings are LEFT NULL in this MVP — set them up
 * when you wire a real embedding model. Retrieval falls back to simple
 * procedure-scoped fetch (lib/kb/retrieve.ts).
 *
 * Usage:
 *   npm run seed:kb
 */

import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SEED_DIR = join(process.cwd(), "lib", "kb", "seed");

function chunkMarkdown(content: string, maxWords = 400): { section: string | null; content: string }[] {
  const lines = content.split("\n");
  const chunks: { section: string | null; content: string }[] = [];
  let currentSection: string | null = null;
  let buffer: string[] = [];
  let wordCount = 0;

  const flush = () => {
    if (buffer.length > 0) {
      chunks.push({ section: currentSection, content: buffer.join("\n").trim() });
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
    buffer.push(line);
    wordCount += line.split(/\s+/).filter(Boolean).length;
    if (wordCount >= maxWords) flush();
  }
  flush();
  return chunks.filter((c) => c.content.length > 0);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const files = readdirSync(SEED_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const procedureId = file.replace(/\.md$/, "");
    const md = readFileSync(join(SEED_DIR, file), "utf-8");
    const chunks = chunkMarkdown(md);
    console.log(`[${procedureId}] ${chunks.length} chunks`);

    // Wipe existing chunks for this procedure (idempotent re-seed).
    await sb.from("procedure_sop_chunks").delete().eq("procedure_id", procedureId);

    const rows = chunks.map((c, i) => ({
      procedure_id: procedureId,
      chunk_order: i,
      section: c.section,
      content: c.content,
      embedding: null,
    }));

    const { error } = await sb.from("procedure_sop_chunks").insert(rows);
    if (error) {
      console.error(`[${procedureId}] insert error:`, error.message);
    } else {
      console.log(`[${procedureId}] seeded ${rows.length} chunks`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
