"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/shared/TopBar";

interface Procedure {
  id: string;
  name: string;
  description: string | null;
  source_url: string | null;
  faculty_scope: string | null;
  indexed_at: string;
  sop_chunks: number;
  active_applications: number;
  letter_templates: number;
}

const PROCEDURE_ICONS: Record<string, string> = {
  scholarship_application: "💰",
  final_year_project: "🎓",
  deferment_of_studies: "⏸️",
  exam_result_appeal: "📝",
  postgrad_admission: "🎒",
  emgs_visa_renewal: "🛂",
};

export default function AdminProcedures({ user }: { user: { name: string; initials: string; email?: string } }) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // SOP upload modal state
  const [step, setStep] = useState<"choose" | "compose" | "confirm">("choose");
  const [inputMode, setInputMode] = useState<"text" | "url" | null>(null);
  const [procId, setProcId] = useState("");
  const [procName, setProcName] = useState("");
  const [procDesc, setProcDesc] = useState("");
  const [sopText, setSopText] = useState("");
  const [sopUrl, setSopUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/admin/procedures");
      const j = await r.json();
      if (j.ok) setProcedures(j.data.procedures);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const resetModal = () => {
    setModalOpen(false);
    setStep("choose");
    setInputMode(null);
    setProcId(""); setProcName(""); setProcDesc("");
    setSopText(""); setSopUrl("");
    setError(null);
  };

  const submitNew = async () => {
    setBusy(true);
    setError(null);
    try {
      // Step 1: create procedure (if doesn't exist; otherwise replace SOP)
      const existing = procedures.find(p => p.id === procId);
      if (!existing) {
        const r = await fetch("/api/admin/procedures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: procId, name: procName,
            description: procDesc || undefined,
            source_url: sopUrl || undefined,
            faculty_scope: null,
          }),
        });
        const j = await r.json();
        if (!j.ok) { setError(j.error); setBusy(false); return; }
      }

      // Step 2: upload SOP
      const r2 = await fetch(`/api/admin/procedures/${procId}/sop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_text: sopText, source_url: sopUrl || null }),
      });
      const j2 = await r2.json();
      if (!j2.ok) { setError(j2.error); setBusy(false); return; }

      setStep("confirm");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const liveCount = procedures.filter(p => p.sop_chunks > 0).length;
  const draftCount = procedures.filter(p => p.sop_chunks === 0).length;

  return (
    <>
      <TopBar
        user={user}
        roleChip={{ label: "Admin · UniGuide" }}
        nav={[{ href: "/admin", label: "Procedures", active: true }]}
      />

      <main className="mx-auto max-w-[1320px] px-8 pt-6 pb-16">
        {/* Office head */}
        <div className="flex items-end justify-between gap-6 mb-5">
          <div>
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight m-0">
              Services <span className="serif italic font-normal text-ink-2">— procedures library</span>
            </h1>
            <div className="text-sm text-ink-3 mt-1">
              Upload an SOP and UniGuide makes it a service. {liveCount} live · {draftCount} draft
            </div>
          </div>
          <button
            className="ug-btn primary"
            onClick={() => { setModalOpen(true); }}
          >
            + New procedure
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Kpi k="Procedures live" v={String(liveCount)} />
          <Kpi k="In draft" v={String(draftCount)} />
          <Kpi k="Active applications" v={String(procedures.reduce((s, p) => s + p.active_applications, 0))} />
          <Kpi k="Letter templates" v={String(procedures.reduce((s, p) => s + p.letter_templates, 0))} ai />
        </div>

        {/* Procedures grid */}
        {loading ? (
          <div className="ug-card p-6 text-ink-4">Loading…</div>
        ) : (
          <div className="grid grid-cols-3 gap-3.5">
            {procedures.map((p) => (
              <Link
                key={p.id}
                href={`/admin/procedures/${p.id}`}
                className="ug-card ug-tile-link p-5 no-underline flex flex-col"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-3xl">{PROCEDURE_ICONS[p.id] ?? "📄"}</div>
                  {p.sop_chunks > 0 ? (
                    <span className="ug-pill ok"><span className="dot" />Live</span>
                  ) : (
                    <span className="ug-pill"><span className="dot" />Draft · No SOP</span>
                  )}
                </div>
                <div className="text-[15px] font-semibold text-ink mb-1">{p.name}</div>
                <div className="text-[12.5px] text-ink-3 mb-4 leading-snug min-h-[36px]">
                  {p.description ?? "—"}
                </div>
                <div className="mt-auto flex items-center justify-between text-[11.5px] text-ink-4 mono">
                  <span>{p.sop_chunks} sections · {p.letter_templates} letters</span>
                  <span>{p.active_applications} active</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* New procedure modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={resetModal}>
          <div className="ug-card w-full max-w-[680px] shadow-ug-lift" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-line-2 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">Step {step === "choose" ? "A" : step === "compose" ? "B" : "C"} of 3</div>
                <div className="text-[18px] font-semibold mt-0.5">
                  {step === "choose" && "Choose how to upload the SOP"}
                  {step === "compose" && "Tell UniGuide about this procedure"}
                  {step === "confirm" && "Procedure is live ✓"}
                </div>
              </div>
              <button className="ug-btn ghost" onClick={resetModal}>Close</button>
            </div>

            {/* Modal body */}
            <div className="p-6">
              {step === "choose" && (
                <div className="grid grid-cols-3 gap-3">
                  <ChoiceTile
                    icon="📄"
                    label="Paste text"
                    desc="Copy the SOP text directly"
                    onClick={() => { setInputMode("text"); setStep("compose"); }}
                  />
                  <ChoiceTile
                    icon="🔗"
                    label="Paste URL"
                    desc="From um.edu.my or a faculty page"
                    onClick={() => { setInputMode("url"); setStep("compose"); }}
                  />
                  <ChoiceTile
                    icon="📎"
                    label="Upload PDF"
                    desc="Coming soon — paste text for now"
                    disabled
                  />
                </div>
              )}

              {step === "compose" && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">Procedure ID</label>
                      <input
                        className="ug-input mt-1.5 mono"
                        placeholder="e.g. hostel_application"
                        value={procId}
                        onChange={(e) => setProcId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">Display name</label>
                      <input
                        className="ug-input mt-1.5"
                        placeholder="e.g. UM Hostel Application"
                        value={procName}
                        onChange={(e) => setProcName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">Short description</label>
                    <input
                      className="ug-input mt-1.5"
                      placeholder="One line — students will see this on the portal"
                      value={procDesc}
                      onChange={(e) => setProcDesc(e.target.value)}
                    />
                  </div>
                  {inputMode === "url" && (
                    <div>
                      <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">Source URL</label>
                      <input
                        className="ug-input mt-1.5"
                        placeholder="https://hep.um.edu.my/..."
                        value={sopUrl}
                        onChange={(e) => setSopUrl(e.target.value)}
                      />
                      <p className="text-[12px] text-ink-4 mt-1.5">PDF parsing isn't wired yet — paste the SOP text below for now.</p>
                    </div>
                  )}
                  <div>
                    <label className="text-[12px] uppercase tracking-wider font-semibold text-ink-4">SOP text</label>
                    <textarea
                      className="ug-textarea mt-1.5 min-h-[280px] mono text-[12.5px]"
                      placeholder={`# Procedure name\n\n## Eligibility\n\n- Bullet 1\n- Bullet 2\n\n## Documents Required\n\n- ...`}
                      value={sopText}
                      onChange={(e) => setSopText(e.target.value)}
                    />
                    <p className="text-[12px] text-ink-4 mt-1.5">
                      Tip: H2 headings (## Eligibility, ## Documents) become natural chunks GLM retrieves at runtime.
                    </p>
                  </div>
                </div>
              )}

              {step === "confirm" && (
                <div className="text-center py-6">
                  <div className="grid place-items-center w-16 h-16 mx-auto mb-4 rounded-full bg-moss text-white">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 className="text-[20px] font-semibold mb-2">Procedure '{procName || procId}' is live</h3>
                  <p className="text-[14px] text-ink-3 max-w-md mx-auto leading-snug">
                    Students can now apply for this through their portal. UniGuide will read the SOP at every step
                    to decide what to ask next.
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Link
                      href={`/admin/procedures/${procId}`}
                      className="ug-btn primary no-underline"
                      onClick={resetModal}
                    >
                      Add letter templates →
                    </Link>
                    <button className="ug-btn" onClick={resetModal}>Done</button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-crimson-soft border border-[#E8C5CB] rounded-lg text-[13px] text-crimson">
                  {error}
                </div>
              )}
            </div>

            {/* Modal footer */}
            {step !== "confirm" && (
              <div className="px-6 py-4 border-t border-line-2 flex items-center justify-between">
                <button
                  className="ug-btn ghost"
                  onClick={() => step === "compose" ? setStep("choose") : resetModal()}
                  disabled={busy}
                >
                  ← {step === "compose" ? "Back" : "Cancel"}
                </button>
                {step === "compose" && (
                  <button
                    className="ug-btn primary"
                    onClick={submitNew}
                    disabled={busy || !procId || !procName || sopText.length < 50}
                  >
                    {busy ? "Indexing…" : "Analyse & make live"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ChoiceTile({ icon, label, desc, onClick, disabled = false }: { icon: string; label: string; desc: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      className={`p-5 rounded-[12px] border text-left transition ${
        disabled
          ? "bg-paper-2 border-line-2 cursor-not-allowed opacity-60"
          : "bg-card border-line hover:border-ink-5 hover:shadow-ug-card cursor-pointer"
      }`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-[14px] font-semibold text-ink">{label}</div>
      <div className="text-[12px] text-ink-4 mt-1 leading-snug">{desc}</div>
    </button>
  );
}

function Kpi({ k, v, ai = false }: { k: string; v: string; ai?: boolean }) {
  return (
    <div className={`rounded-[10px] px-3.5 py-2.5 border ${ai ? "border-ai-line bg-ai-tint" : "border-line bg-card"}`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{k}</div>
      <div className={`text-xl font-semibold mt-0.5 ${ai ? "text-ai-ink" : "text-ink"}`}>{v}</div>
    </div>
  );
}
