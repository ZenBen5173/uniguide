"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Database } from "lucide-react";

interface Trace {
  id: string;
  workflow_id: string | null;
  endpoint: string;
  model_version: string;
  input_summary: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  confidence: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  cache_hit: boolean | null;
  called_at: string;
}

const ENDPOINT_TONE: Record<string, string> = {
  intent: "bg-ai-tint text-ai-ink border-ai-line",
  plan: "bg-ai-tint text-ai-ink border-ai-line",
  next_step: "bg-ai-tint text-ai-ink border-ai-line",
  brief: "bg-amber-soft text-amber border-[#E8DBB5]",
  fill_letter: "bg-moss-soft text-moss border-[#CFDDCF]",
  estimate_progress: "bg-paper-2 text-ink-3 border-line-2",
  parse: "bg-paper-2 text-ink-3 border-line-2",
  adapt: "bg-paper-2 text-ink-3 border-line-2",
  route: "bg-paper-2 text-ink-3 border-line-2",
};

export default function GlmTraceList({ traces }: { traces: Trace[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [endpointFilter, setEndpointFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const endpoints = useMemo(() => {
    const set = new Set<string>();
    traces.forEach((t) => set.add(t.endpoint));
    return Array.from(set).sort();
  }, [traces]);

  const filtered = useMemo(() => {
    let xs = traces;
    if (endpointFilter !== "all") xs = xs.filter((t) => t.endpoint === endpointFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      xs = xs.filter((t) => {
        const hay = [
          t.endpoint, t.model_version, t.workflow_id ?? "",
          JSON.stringify(t.input_summary ?? {}),
          JSON.stringify(t.output ?? {}),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return xs;
  }, [traces, endpointFilter, search]);

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  return (
    <div className="ug-card overflow-hidden">
      <div className="px-4 py-3 border-b border-line-2 bg-paper-2 flex items-center gap-3 flex-wrap">
        <Database className="h-3.5 w-3.5 text-ink-4" strokeWidth={1.85} />
        <input
          className="flex-1 min-w-[160px] bg-transparent text-[13px] outline-none border-0 text-ink"
          placeholder="Search endpoint, workflow id, prompt input/output…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={endpointFilter}
          onChange={(e) => setEndpointFilter(e.target.value)}
          className="px-2.5 py-1 rounded-md border border-line bg-card text-[12px] font-medium text-ink-2"
        >
          <option value="all">All endpoints</option>
          {endpoints.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <span className="text-[11.5px] text-ink-4 mono">{filtered.length} / {traces.length}</span>
      </div>

      {filtered.length === 0 && (
        <div className="px-5 py-12 text-center text-ink-4 text-[13px]">
          No traces match. {endpointFilter !== "all" || search ? "Try clearing filters." : "Run an application step to generate one."}
        </div>
      )}

      <div className="divide-y divide-line-2">
        {filtered.map((t) => {
          const isOpen = open.has(t.id);
          const tone = ENDPOINT_TONE[t.endpoint] ?? "bg-paper-2 text-ink-3 border-line-2";
          return (
            <div key={t.id}>
              <button
                onClick={() => toggle(t.id)}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-paper-2 transition cursor-pointer"
              >
                <ChevronRight className={`h-3.5 w-3.5 text-ink-4 transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={2.25} />
                <span className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wider border min-w-[88px] text-center ${tone}`}>
                  {t.endpoint.replace(/_/g, " ")}
                </span>
                <span className="text-[12.5px] text-ink-3 mono flex-1 truncate">{t.model_version}</span>
                {t.confidence !== null && (
                  <span className="text-[11px] text-ink-3 mono">conf {Number(t.confidence).toFixed(2)}</span>
                )}
                <span className="text-[11px] text-ink-4 mono">{t.latency_ms ?? "—"}ms</span>
                <span className="text-[11px] text-ink-4 mono w-[64px] text-right">
                  {(t.input_tokens ?? 0) + (t.output_tokens ?? 0)}t
                </span>
                {t.cache_hit && (
                  <span className="text-[10.5px] text-ai-ink font-semibold">CACHED</span>
                )}
                <span className="text-[11px] text-ink-4 w-[110px] text-right">
                  {timeAgo(t.called_at)}
                </span>
              </button>
              {isOpen && (
                <div className="bg-paper-2 px-4 py-4 border-t border-line-2 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-4 mb-1.5">Input summary</div>
                    <pre className="text-[11px] mono text-ink-2 bg-card border border-line-2 rounded p-2.5 max-h-[280px] overflow-auto whitespace-pre-wrap leading-relaxed">{JSON.stringify(t.input_summary ?? {}, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ink-4 mb-1.5">Output</div>
                    <pre className="text-[11px] mono text-ink-2 bg-card border border-line-2 rounded p-2.5 max-h-[280px] overflow-auto whitespace-pre-wrap leading-relaxed">{JSON.stringify(t.output ?? {}, null, 2)}</pre>
                  </div>
                  {t.workflow_id && (
                    <div className="col-span-2 text-[11px] text-ink-4 mono">
                      workflow / application id: <span className="text-ink-2">{t.workflow_id}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
