"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Library, X, Search } from "lucide-react";

export interface SopViewerHandle {
  openWithSection: (section: string) => void;
}

interface Chunk {
  id: string;
  chunk_order: number;
  section: string | null;
  content: string;
  source_url: string | null;
}

interface SopData {
  procedure: {
    id: string;
    name: string;
    description: string | null;
    source_url: string | null;
    source_pdf_path?: string | null;
    indexed_at: string;
  };
  chunks: Chunk[];
}

const SopViewer = forwardRef<SopViewerHandle, { procedureId: string }>(function SopViewer({ procedureId }, ref) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SopData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    openWithSection: (section: string) => {
      setSearch(section);
      setOpen(true);
    },
  }), []);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/procedures/${procedureId}/sop`);
        const j = await r.json();
        if (j.ok) setData(j.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, procedureId, data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    if (!q || !data) return data?.chunks ?? [];
    return data.chunks.filter(
      (c) =>
        (c.section ?? "").toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q)
    );
  })();

  const sectionList = (() => {
    if (!data) return [];
    const seen = new Set<string>();
    const list: { ordinal: number; section: string }[] = [];
    data.chunks.forEach((c) => {
      if (c.section && !seen.has(c.section)) {
        seen.add(c.section);
        list.push({ ordinal: c.chunk_order, section: c.section });
      }
    });
    return list;
  })();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ug-rail-card text-left hover:bg-paper-2 transition cursor-pointer p-0 w-full"
        type="button"
      >
        <div className="ug-rail-head" style={{ borderBottom: "0" }}>
          <div className="ug-rail-title flex items-center gap-2">
            <Library className="h-3.5 w-3.5 text-ai-ink" strokeWidth={1.85} />
            View the source SOP
          </div>
          <span className="text-[11px] text-ink-4">→</span>
        </div>
        <div className="px-4 pb-3 -mt-1">
          <p className="text-[12px] text-ink-4 leading-snug">
            See the official UM document the AI is reading from at every step.
          </p>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 sm:p-6" onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            className="ug-card w-full max-w-[860px] max-h-[90vh] overflow-hidden flex flex-col shadow-ug-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 sm:px-6 py-4 border-b border-line-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink mb-1">Source SOP</div>
                <div className="text-[18px] font-semibold leading-tight truncate">
                  {data?.procedure.name ?? "Loading…"}
                </div>
                {data && (
                  <div className="text-[11.5px] text-ink-4 mono mt-1 flex items-center gap-2 flex-wrap">
                    <span>{data.chunks.length} chunks indexed</span>
                    {data.procedure.indexed_at && <>
                      <span>·</span>
                      <span>indexed {new Date(data.procedure.indexed_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </>}
                    {data.procedure.source_url && <>
                      <span>·</span>
                      <a href={data.procedure.source_url} target="_blank" rel="noreferrer" className="text-crimson hover:underline">
                        source URL ↗
                      </a>
                    </>}
                    {data.procedure.source_pdf_path && <>
                      <span>·</span>
                      <a
                        href={`/api/procedures/${data.procedure.id}/source-pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-crimson hover:underline"
                        title="Open the original SOP PDF in a new tab"
                      >
                        original PDF ↗
                      </a>
                    </>}
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded text-ink-4 hover:text-ink hover:bg-paper-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-3 border-b border-line-2 bg-paper-2 flex items-center gap-2.5">
              <Search className="h-3.5 w-3.5 text-ink-4" strokeWidth={1.75} />
              <input
                className="flex-1 bg-transparent text-[13px] text-ink outline-none border-0"
                placeholder="Search the SOP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-[11px] text-ink-4 hover:text-ink">Clear</button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="p-6 space-y-3 animate-pulse">
                  <div className="h-3 w-1/3 rounded bg-line-2" />
                  <div className="h-3 w-full rounded bg-line-2" />
                  <div className="h-3 w-5/6 rounded bg-line-2" />
                  <div className="h-3 w-4/5 rounded bg-line-2" />
                </div>
              )}

              {!loading && data && data.chunks.length === 0 && (
                <div className="p-12 text-center text-ink-4">
                  No SOP indexed yet for this procedure.
                </div>
              )}

              {!loading && data && filtered.length === 0 && data.chunks.length > 0 && (
                <div className="p-12 text-center text-ink-4 text-[13px]">
                  Nothing matches <span className="mono">"{search}"</span>.
                </div>
              )}

              <div className="divide-y divide-line-2">
                {filtered.map((c) => (
                  <div key={c.id} className="px-5 sm:px-6 py-4">
                    {c.section && (
                      <div className="text-[10.5px] uppercase tracking-wider font-semibold text-ai-ink mb-1.5 mono">
                        {c.section}
                      </div>
                    )}
                    <p className="text-[13.5px] text-ink-2 leading-relaxed whitespace-pre-wrap m-0">
                      {highlight(c.content, search)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {sectionList.length > 0 && (
              <div className="px-5 sm:px-6 py-2.5 border-t border-line-2 bg-paper-2 text-[11.5px] text-ink-4 flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold uppercase tracking-wider">Sections:</span>
                {sectionList.slice(0, 8).map((s) => (
                  <span key={s.ordinal} className="px-1.5 py-0.5 rounded mono bg-card border border-line text-ink-3">{s.section}</span>
                ))}
                {sectionList.length > 8 && <span className="text-ink-4">+{sectionList.length - 8} more</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

export default SopViewer;

function highlight(text: string, q: string): React.ReactNode {
  const term = q.trim();
  if (!term) return text;
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p)
      ? <mark key={i} className="bg-amber-soft text-ink px-0.5 rounded-sm">{p}</mark>
      : <span key={i}>{p}</span>
  );
}
