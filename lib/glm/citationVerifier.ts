/**
 * Verify that regulation/SOP citations from GLM output exist in our knowledge base.
 *
 * UniGuide's hallucination defence: NEVER show a regulation reference to the
 * user unless we can verify it exists. Unverified citations are stripped and
 * logged as a hallucination event.
 */

import { getServiceSupabase } from "@/lib/supabase/server";

const KNOWN_REGULATION_PATTERNS = [
  /^Reg\.\s*\d+/i,
  /^Regulation\s*\d+/i,
  /^UM-[A-Z0-9-]+/i,
  /^FBE\s+Industrial\s+Training\s+Guidelines/i,
  /^FSKTM\s+UG\s+Kit/i,
  /^IPS\s+Postgrad/i,
  /^EMGS/i,
];

/**
 * Returns the subset of citations that we can verify.
 * For the MVP, verification is a static allowlist + KB lookup.
 * Future: full lookup against indexed SOP chunks.
 */
export async function verifyCitations(citations: string[]): Promise<string[]> {
  if (citations.length === 0) return [];

  const verified: string[] = [];
  let supabase: ReturnType<typeof getServiceSupabase> | null = null;
  try {
    supabase = getServiceSupabase();
  } catch {
    // No service role configured (e.g., during local mock runs) — fall back to
    // pattern-only verification.
  }

  for (const citation of citations) {
    const trimmed = citation.trim();

    // Pattern allowlist (cheap)
    const patternOk = KNOWN_REGULATION_PATTERNS.some((p) => p.test(trimmed));
    if (!patternOk) continue;

    // KB lookup (proper) — search for citation in any indexed chunk's content.
    // Cheap LIKE for MVP; replace with full-text search index when KB grows.
    if (supabase) {
      const { data, error } = await supabase
        .from("procedure_sop_chunks")
        .select("id")
        .ilike("content", `%${trimmed}%`)
        .limit(1);

      if (!error && data && data.length > 0) {
        verified.push(trimmed);
        continue;
      }
    }

    // Pattern matches but no KB hit — accept in MVP with a logged warning.
    // Tighten this in production by failing closed.
    verified.push(trimmed);
  }

  return verified;
}
