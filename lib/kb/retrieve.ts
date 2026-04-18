/**
 * KB retrieval — fetches relevant SOP chunks for a procedure to feed into
 * the GLM workflow planner.
 *
 * MVP: returns ALL chunks for a procedure (full SOP fits in context window).
 * Future: vector kNN search via the match_sop_chunks() RPC.
 */

import { getServiceSupabase } from "@/lib/supabase/server";

export async function retrieveProcedureSop(procedureId: string): Promise<string[]> {
  const sb = getServiceSupabase();
  const { data, error } = await sb
    .from("procedure_sop_chunks")
    .select("section, content")
    .eq("procedure_id", procedureId)
    .order("chunk_order");
  if (error || !data) return [];
  return data.map((c: { section: string | null; content: string }) =>
    c.section ? `## ${c.section}\n${c.content}` : c.content
  );
}
