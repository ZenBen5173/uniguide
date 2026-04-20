/**
 * Admin GLM trace viewer — every model call this app makes is logged to
 * glm_reasoning_trace. This page is the audit window into "what the AI
 * was actually thinking" at every decision point. Surfaces endpoint,
 * latency, token usage, confidence, and the full input/output JSON.
 *
 * Critical for the hackathon brief's transparency requirement.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import TopBar from "@/components/shared/TopBar";
import GlmTraceList from "@/components/admin/GlmTraceList";

export default async function GlmTracesPage() {
  const user = await requireRole(["admin", "staff"]);
  if (!user) redirect("/login?next=/admin/glm-traces");

  const sb = getServiceSupabase();

  const [{ data: traces, count }, { data: profile }] = await Promise.all([
    sb.from("glm_reasoning_trace")
      .select("id, workflow_id, endpoint, model_version, input_summary, output, confidence, input_tokens, output_tokens, latency_ms, cache_hit, called_at", { count: "exact" })
      .order("called_at", { ascending: false })
      .limit(100),
    sb.from("staff_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ]);

  const name = profile?.full_name ?? user.email.split("@")[0];
  const initials = name.split(/\s+/).map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "A";

  // Aggregate metrics for the header strip
  const list = traces ?? [];
  const totalLatency = list.reduce((s, t) => s + (t.latency_ms ?? 0), 0);
  const avgLatency = list.length ? Math.round(totalLatency / list.length) : 0;
  const totalTokens = list.reduce((s, t) => s + (t.input_tokens ?? 0) + (t.output_tokens ?? 0), 0);
  const cacheHits = list.filter(t => t.cache_hit).length;

  return (
    <>
      <TopBar
        user={{ name, initials, email: user.email }}
        roleChip={{ label: "Admin · UniGuide" }}
        nav={[
          { href: "/admin", label: "Procedures" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/glm-traces", label: "GLM traces", active: true },
        ]}
      />

      <main className="mx-auto max-w-[1320px] px-8 pt-6 pb-16">
        <div className="mb-5">
          <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight m-0">
            GLM reasoning traces <span className="serif italic font-normal text-ink-2">— audit the AI</span>
          </h1>
          <p className="text-sm text-ink-3 mt-1">
            Every Z.AI GLM call this app makes is logged here. Click any row to inspect the prompt input + structured output.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <Kpi k="Calls (last 100)" v={String(list.length)} sub={`${count ?? 0} all-time`} />
          <Kpi k="Avg latency" v={`${avgLatency} ms`} sub="end-to-end" />
          <Kpi k="Tokens used" v={totalTokens.toLocaleString()} sub="input + output" />
          <Kpi k="Cache hits" v={`${cacheHits} / ${list.length}`} sub={list.length ? `${Math.round((cacheHits / list.length) * 100)}%` : "—"} ai />
        </div>

        <GlmTraceList traces={list} />

        <p className="mt-6 text-[12px] text-ink-4">
          Showing the most recent 100 calls. For older traces query the <span className="mono text-ink-3">glm_reasoning_trace</span> table directly.
          {" · "}
          <Link href="/admin/analytics" className="text-crimson hover:underline">Operational analytics →</Link>
        </p>
      </main>
    </>
  );
}

function Kpi({ k, v, sub, ai = false }: { k: string; v: string; sub?: string; ai?: boolean }) {
  return (
    <div className={`rounded-[10px] px-4 py-3 border ${ai ? "border-ai-line bg-ai-tint" : "border-line bg-card"}`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{k}</div>
      <div className={`text-[22px] font-semibold mt-1 leading-none mono ${ai ? "text-ai-ink" : "text-ink"}`}>{v}</div>
      {sub && <div className="text-[11.5px] text-ink-4 mt-1.5">{sub}</div>}
    </div>
  );
}
