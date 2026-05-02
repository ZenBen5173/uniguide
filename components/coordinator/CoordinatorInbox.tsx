"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/shared/TopBar";
import { useSilentRefresh } from "@/lib/hooks/useSilentRefresh";

interface InboxApp {
  id: string;
  user_id: string;
  procedure_id: string;
  status: string;
  ai_recommendation: "approve" | "reject" | "request_info" | null;
  ai_confidence: number | null;
  student_summary: string | null;
  submitted_at: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  escalation_pending?: boolean | null;
  escalation_opened_at?: string | null;
  procedures?: { name: string };
  student_profiles?: {
    full_name: string;
    faculty: string | null;
    programme: string | null;
    year: number | null;
    cgpa: number | null;
    citizenship: string;
  };
  flags: Array<{ severity: "info" | "warn" | "block"; message: string }>;
}

interface Counts { pending: number; approved: number; rejected: number; more_info: number; draft: number; triage?: number }

const FILTER_TABS = [
  { key: "pending", label: "Pending" },
  { key: "triage", label: "Triage", highlight: true },
  { key: "draft", label: "Drafts" },
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "more_info_requested", label: "Needs me" },
];

export default function CoordinatorInbox({ user }: { user: { name: string; initials: string; email?: string } }) {
  const router = useRouter();
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [procedureFilter, setProcedureFilter] = useState<string>("all");
  const [apps, setApps] = useState<InboxApp[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0, more_info: 0, draft: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [coordinatorId, setCoordinatorId] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/coordinator/inbox?status=${filter}`);
      const json = await res.json();
      if (json.ok) {
        setApps(json.data.applications);
        setCounts(json.data.counts);
        // Don't blow away the coordinator's selection on a silent re-fetch —
        // they might be mid-bulk-action.
        if (!silent) setSelected(new Set());
        if (json.data.coordinator?.id) setCoordinatorId(json.data.coordinator.id);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Silent re-fetch every 20s + on tab focus / visibility — covers the case
  // where another coordinator decides on a row, or a student submits, while
  // this inbox is open. Without it, the row's status / counts go stale until
  // the user clicks a tab or refreshes manually.
  useSilentRefresh(() => refresh({ silent: true }), 20_000);

  const claim = async (id: string) => {
    await fetch(`/api/coordinator/applications/${id}/claim`, { method: "POST" });
    await refresh();
  };
  const release = async (id: string) => {
    await fetch(`/api/coordinator/applications/${id}/claim`, { method: "DELETE" });
    await refresh();
  };

  useEffect(() => { void refresh(); }, [filter]);

  // Reset focus to top whenever the underlying list changes.
  useEffect(() => { setFocusIdx(0); }, [filter, search, procedureFilter]);

  const procedureOptions = useMemo(() => {
    const map = new Map<string, string>();
    apps.forEach((a) => {
      if (!map.has(a.procedure_id)) {
        map.set(a.procedure_id, a.procedures?.name ?? a.procedure_id);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [apps]);

  // Sort: AI urgency first (low confidence + flags), then submitted_at desc.
  // Search: filter by student name, matric, or procedure name (case-insensitive).
  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = procedureFilter === "all" ? apps : apps.filter((a) => a.procedure_id === procedureFilter);
    if (mineOnly && coordinatorId) {
      filtered = filtered.filter((a) => a.assigned_to === coordinatorId);
    }
    if (q) {
      filtered = filtered.filter((a) => {
        const hay = [
          a.student_profiles?.full_name,
          a.procedures?.name,
          a.procedure_id,
          a.student_summary,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return [...filtered].sort((a, b) => {
      const urgentA = (a.flags?.some(f => f.severity === "block") ? 2 : 0) + (a.ai_confidence !== null && a.ai_confidence < 0.7 ? 1 : 0);
      const urgentB = (b.flags?.some(f => f.severity === "block") ? 2 : 0) + (b.ai_confidence !== null && b.ai_confidence < 0.7 ? 1 : 0);
      if (urgentA !== urgentB) return urgentB - urgentA;
      return (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "");
    });
  }, [apps, search, procedureFilter, mineOnly, coordinatorId]);

  const mineCount = coordinatorId ? apps.filter((a) => a.assigned_to === coordinatorId).length : 0;

  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.filter(canBulkApprove).map(a => a.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all([...selected].map(id =>
        fetch(`/api/coordinator/applications/${id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approve" }),
        })
      ));
      await refresh();
    } finally {
      setBulkBusy(false);
    }
  };

  const [bulkInfoOpen, setBulkInfoOpen] = useState(false);
  const [bulkInfoMessage, setBulkInfoMessage] = useState("");

  const bulkRequestInfo = async () => {
    if (selected.size === 0 || bulkInfoMessage.trim().length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all([...selected].map(id =>
        fetch(`/api/coordinator/applications/${id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "request_info", comment: bulkInfoMessage.trim() }),
        })
      ));
      setBulkInfoOpen(false);
      setBulkInfoMessage("");
      await refresh();
    } finally {
      setBulkBusy(false);
    }
  };

  const eligibleForBulk = sorted.filter(canBulkApprove);
  const excludedFromBulk = sorted.length - eligibleForBulk.length;

  // Keyboard nav: j/k to move, Enter to open, / to focus search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? "";
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t?.isContentEditable ?? false);

      if (!inField && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (inField) return;
      if (sorted.length === 0) return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(sorted.length - 1, i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const target = sorted[focusIdx];
        if (target) {
          e.preventDefault();
          router.push(`/coordinator/applications/${target.id}`);
        }
      } else if (e.key === "g") {
        e.preventDefault();
        setFocusIdx(0);
      } else if (e.key === "G") {
        e.preventDefault();
        setFocusIdx(sorted.length - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sorted, focusIdx, router]);

  return (
    <>
      <TopBar
        user={user}
        roleChip={{ label: "Coordinator · Yayasan UM" }}
        nav={[{ href: "/coordinator/inbox", label: "Inbox", active: true }]}
      />

      <main className="mx-auto max-w-[1440px] px-8 pt-6 pb-16">
        {/* Office head */}
        <div className="flex items-end justify-between gap-6 mb-4">
          <div>
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight m-0">
              Yayasan UM Scholarship Office <span className="serif italic font-normal text-ink-2">— inbox</span>
            </h1>
            <div className="text-sm text-ink-3 mt-1">
              {new Date().toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "short", year: "numeric" })} ·{" "}
              <span className="mono text-ink-2">{counts.pending}</span> applications in queue · SLA 48h response window
            </div>
          </div>
          <div className="flex gap-2">
            <Kpi k="Ready to approve" v={String(eligibleForBulk.length)} ai />
            <Kpi k="Pending review" v={String(counts.pending)} />
            <Kpi k="Decided this week" v={String(counts.approved + counts.rejected)} />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3.5 my-4">
          <div className="flex-1 max-w-[520px] flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-line rounded-[10px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-ink-4">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              className="flex-1 border-0 outline-none bg-transparent text-sm text-ink"
              placeholder="Search by student name or procedure…  (press / to focus)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); (e.target as HTMLInputElement).blur(); } }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-[11px] text-ink-4 hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-1">
            {FILTER_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border ${
                  filter === t.key
                    ? "bg-card border-line text-ink"
                    : t.key === "triage" && (counts.triage ?? 0) > 0
                    ? "bg-amber-soft border-[#E8DBB5] text-amber hover:opacity-90"
                    : "bg-transparent border-transparent text-ink-3 hover:bg-[rgba(11,37,69,.04)]"
                }`}
              >
                {t.label}
                {t.key === "pending" && (
                  <span className={`mono text-[11px] px-1.5 rounded ${
                    filter === "pending" ? "bg-ink text-white" : "bg-line-2 text-ink-3"
                  }`}>{counts.pending}</span>
                )}
                {t.key === "triage" && (counts.triage ?? 0) > 0 && (
                  <span className={`mono text-[11px] px-1.5 rounded ${
                    filter === "triage" ? "bg-amber text-white" : "bg-amber text-white"
                  }`}>{counts.triage}</span>
                )}
                {t.key === "draft" && counts.draft > 0 && (
                  <span className={`mono text-[11px] px-1.5 rounded ${
                    filter === "draft" ? "bg-ink text-white" : "bg-line-2 text-ink-3"
                  }`}>{counts.draft}</span>
                )}
                {t.key === "more_info_requested" && counts.more_info > 0 && (
                  <span className="mono text-[11px] px-1.5 rounded bg-crimson text-white">{counts.more_info}</span>
                )}
              </button>
            ))}
          </div>
          {procedureOptions.length > 1 && (
            <select
              value={procedureFilter}
              onChange={(e) => setProcedureFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-line bg-card text-[13px] font-medium text-ink-2 cursor-pointer hover:border-ink-5"
              title="Filter by procedure"
            >
              <option value="all">All procedures</option>
              {procedureOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setMineOnly((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] font-medium ${
              mineOnly ? "bg-ink text-white border-ink" : "bg-card text-ink-2 border-line hover:border-ink-5"
            }`}
            title="Show only applications you've claimed"
          >
            Mine
            <span className={`mono text-[11px] px-1.5 rounded ${mineOnly ? "bg-white/20" : "bg-line-2 text-ink-3"}`}>
              {mineCount}
            </span>
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-ai-line bg-ai-tint text-[13px] font-medium text-ai-ink" title="Applications with low AI confidence or block-flags surface first">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.35 5.6L20 8l-4 4 1.1 5.9L12 15.5 6.9 17.9 8 12 4 8l5.65-.4z" />
            </svg>
            <span className="opacity-70">Sorted by</span> AI urgency
          </div>
        </div>

        {/* Sticky select bar */}
        {selected.size > 0 && (
          <div className="sticky top-[58px] z-20 bg-ink text-white rounded-[12px] py-2.5 pl-4 pr-3 flex items-center gap-3.5 shadow-ug-lift mb-3">
            <span className="text-[13.5px] font-semibold flex items-center gap-2.5">
              <span className="inline-grid place-items-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-crimson text-white text-xs font-bold">
                {selected.size}
              </span>
              {selected.size} selected
            </span>
            {excludedFromBulk > 0 && (
              <span className="text-[12.5px] text-white/60">
                · <span className="mono text-amber-soft">{excludedFromBulk}</span> excluded — flagged or low confidence
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setSelected(new Set())}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white/[.08] text-white border border-white/[.12] hover:bg-white/[.14]"
              >
                Clear
              </button>
              <button
                onClick={() => setBulkInfoOpen((v) => !v)}
                disabled={bulkBusy}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-amber-soft text-amber border border-amber-soft hover:bg-white/[.14]"
                style={{ borderColor: "#E8DBB5" }}
                title="Send the same request-for-info to all selected"
              >
                Request info
              </button>
              <button
                onClick={bulkApprove}
                disabled={bulkBusy}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white text-ink border border-white"
              >
                {bulkBusy ? "Approving…" : `Approve ${selected.size} selected`}
              </button>
            </div>
          </div>
        )}

        {bulkInfoOpen && selected.size > 0 && (
          <div className="sticky top-[100px] z-10 bg-card border border-line rounded-[12px] px-4 py-3 mb-3 shadow-ug-card">
            <div className="text-[12px] uppercase tracking-wider font-semibold text-amber mb-2">
              Request info from {selected.size} selected
            </div>
            <textarea
              className="ug-textarea text-[13px]"
              placeholder="What do you need from each of these students? This message will be added as the next step in their flow."
              value={bulkInfoMessage}
              onChange={(e) => setBulkInfoMessage(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                className="ug-btn ghost sm"
                onClick={() => { setBulkInfoOpen(false); setBulkInfoMessage(""); }}
                disabled={bulkBusy}
              >
                Cancel
              </button>
              <button
                className="ug-btn primary sm"
                onClick={bulkRequestInfo}
                disabled={bulkBusy || bulkInfoMessage.trim().length === 0}
                style={{ background: "var(--amber)", color: "white", borderColor: "var(--amber)" }}
              >
                {bulkBusy ? "Sending…" : `Send to ${selected.size}`}
              </button>
            </div>
          </div>
        )}

        {/* Keyboard hint */}
        <div className="hidden lg:flex items-center gap-2 text-[11.5px] text-ink-4 mb-2">
          <Kbd>j</Kbd><Kbd>k</Kbd><span className="mr-1">navigate</span>
          <span className="text-ink-5">·</span>
          <Kbd>Enter</Kbd><span className="mr-1">open</span>
          <span className="text-ink-5">·</span>
          <Kbd>/</Kbd><span className="mr-1">search</span>
          <span className="text-ink-5">·</span>
          <Kbd>g</Kbd>/<Kbd>G</Kbd><span>top / bottom</span>
        </div>

        {/* Table */}
        <div className="ug-card overflow-x-auto">
          {loading ? (
            <div className="divide-y divide-line-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="px-4 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-[17px] h-[17px] rounded bg-line-2" />
                  <div className="w-8 h-8 rounded-full bg-line-2" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 rounded bg-line-2 w-1/3" />
                    <div className="h-2.5 rounded bg-line-2 w-1/4" />
                  </div>
                  <div className="w-16 h-5 rounded bg-line-2" />
                  <div className="w-12 h-5 rounded bg-line-2" />
                  <div className="w-20 h-5 rounded bg-line-2" />
                  <div className="w-16 h-5 rounded bg-line-2" />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center gap-8 p-12 bg-card">
              <div className="relative w-[180px] h-[110px] flex-shrink-0">
                <div className="absolute inset-0 border-[1.5px] border-moss rounded-full opacity-30" />
                <div className="absolute inset-3 border-[1.5px] border-moss rounded-full opacity-15" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full bg-moss text-white grid place-items-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-[24px] font-semibold tracking-tight m-0 mb-1.5">
                  Inbox <span className="serif italic font-normal">zero</span>
                </h3>
                <p className="text-[14px] text-ink-3 max-w-md leading-snug">
                  {counts.approved + counts.rejected} application{counts.approved + counts.rejected === 1 ? "" : "s"} decided this week. New submissions will surface here as students complete them.
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th className="w-8 pr-0">
                    <CheckBox
                      checked={selected.size > 0 && selected.size === eligibleForBulk.length}
                      onClick={toggleAll}
                    />
                  </Th>
                  <Th>Student</Th>
                  <Th>Tier</Th>
                  <Th>CGPA</Th>
                  <Th>AI rec</Th>
                  <Th>Submitted</Th>
                  <Th className="text-right">Flags</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, idx) => {
                  const isSelected = selected.has(a.id);
                  const isUrgent = a.flags?.some(f => f.severity === "block") || (a.ai_confidence !== null && a.ai_confidence < 0.7);
                  const isBulkable = canBulkApprove(a);
                  const isFocused = idx === focusIdx;
                  const ageHours = a.submitted_at && a.status === "submitted"
                    ? (Date.now() - new Date(a.submitted_at).getTime()) / 3_600_000
                    : null;
                  const slaTint = ageHours === null ? "" :
                    ageHours >= 40 ? "[background:linear-gradient(90deg,rgba(161,37,58,.06),transparent_180px)]" :
                    ageHours >= 24 ? "[background:linear-gradient(90deg,rgba(184,147,90,.07),transparent_180px)]" : "";
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-line-2 hover:bg-paper-2 transition cursor-pointer ${isSelected ? "bg-[#F1F2F6]" : ""} ${isUrgent ? "[background:linear-gradient(90deg,rgba(161,37,58,.04),transparent_140px)]" : slaTint} ${isFocused ? "outline outline-2 outline-ink/60 outline-offset-[-2px]" : ""}`}
                      onClick={() => router.push(`/coordinator/applications/${a.id}`)}
                      onMouseEnter={() => setFocusIdx(idx)}
                    >
                      <td className="px-3.5 py-3.5 pr-0 w-8" onClick={(e) => { e.stopPropagation(); if (isBulkable) toggleOne(a.id); }}>
                        <CheckBox checked={isSelected} disabled={!isBulkable} />
                      </td>
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-gold-soft text-ink font-semibold text-xs">
                            {studentInitials(a.student_profiles?.full_name)}
                          </div>
                          <div>
                            <div className="font-semibold text-ink text-[13.5px] flex items-center gap-2">
                              {a.student_profiles?.full_name ?? "Unknown student"}
                              {a.escalation_pending && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-soft text-amber border border-[#E8DBB5]"
                                  title="Student raised an escalation — they're asking for human help."
                                >
                                  Triage
                                </span>
                              )}
                              {a.assigned_to && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    a.assigned_to === coordinatorId
                                      ? "bg-ai-tint text-ai-ink border border-ai-line"
                                      : "bg-paper-2 text-ink-3 border border-line-2"
                                  }`}
                                  title={`Claimed by ${a.assignee_name}`}
                                >
                                  {a.assigned_to === coordinatorId ? "you" : (a.assignee_name?.split(" ")[0] ?? "claimed")}
                                </span>
                              )}
                            </div>
                            <div className="text-[12px] text-ink-3 mt-0.5 flex items-center gap-1.5">
                              {a.procedures?.name ? (
                                <span>{a.procedures.name}</span>
                              ) : (
                                <span className="mono text-[11.5px]">{a.procedure_id}</span>
                              )}
                              {a.student_profiles?.faculty && <>
                                <span className="w-[3px] h-[3px] rounded-full bg-ink-5 flex-shrink-0" />
                                <span className="text-ink-4">{a.student_profiles.faculty}</span>
                              </>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <TierBadge income={a.student_summary} />
                      </td>
                      <td className="px-3.5 py-3.5">
                        <span className={`mono font-semibold text-[13px] ${(a.student_profiles?.cgpa ?? 4) < 3.3 ? "text-amber" : "text-ink-2"}`}>
                          {a.student_profiles?.cgpa?.toFixed(2) ?? "—"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3.5">
                        {a.ai_recommendation && (
                          <div className="flex flex-col items-start gap-1">
                            <span className={`ug-rec ${a.ai_recommendation === "approve" ? "approve" : a.ai_recommendation === "reject" ? "reject" : "review"}`}>
                              {a.ai_recommendation === "approve" ? "Approve" : a.ai_recommendation === "reject" ? "Reject" : "Review"}
                            </span>
                            {a.ai_confidence !== null && (
                              <ConfidenceLabel value={a.ai_confidence} />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-[12.5px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-ink-4">{a.submitted_at ? relativeTime(a.submitted_at) : "—"}</span>
                          {ageHours !== null && ageHours >= 24 && (
                            <span className={`inline-flex items-center gap-1 text-[10.5px] font-semibold ${ageHours >= 40 ? "text-crimson" : "text-amber"}`}>
                              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: ageHours >= 40 ? "var(--crimson)" : "var(--amber)" }} />
                              {ageHours >= 40 ? "SLA breached" : "SLA approaching"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-3.5 text-right">
                        <div className="inline-flex gap-1.5">
                          {a.flags?.map((f, i) => (
                            <span
                              key={i}
                              title={f.message}
                              className={`grid place-items-center w-[22px] h-[22px] rounded-md ${
                                f.severity === "block"
                                  ? "bg-crimson-soft text-crimson"
                                  : f.severity === "warn"
                                  ? "bg-amber-soft text-amber"
                                  : "bg-ai-tint text-ai-ink"
                              }`}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="pr-3 py-3.5 text-right">
                        <span className="ug-row-chevron" aria-hidden>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono inline-block px-1.5 py-0.5 rounded border border-line-2 bg-paper-2 text-ink-3 font-medium text-[10.5px]">
      {children}
    </span>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-[11px] font-semibold text-ink-4 uppercase tracking-wider px-3.5 py-3 bg-paper-2 border-b border-line ${className}`}>
      {children}
    </th>
  );
}

function CheckBox({ checked, onClick, disabled }: { checked: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }}
      disabled={disabled}
      className={`grid place-items-center w-[17px] h-[17px] rounded-md border-[1.5px] ${
        disabled
          ? "bg-line-2 border-line cursor-not-allowed"
          : checked
          ? "bg-ink border-ink"
          : "bg-card border-ink-5 cursor-pointer"
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

function Kpi({ k, v, ai = false }: { k: string; v: string; ai?: boolean }) {
  return (
    <div className={`bg-card border border-line rounded-[10px] px-3.5 py-2 min-w-[110px] ${ai ? "border-ai-line bg-ai-tint" : ""}`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{k}</div>
      <div className={`text-lg font-semibold mt-0.5 ${ai ? "text-ai-ink" : "text-ink"}`}>{v}</div>
    </div>
  );
}

function TierBadge({ income }: { income: string | null }) {
  if (!income) return <span className="text-ink-4 text-[11.5px]">—</span>;
  // crude detection from running summary
  const tier = /B40/i.test(income) ? "b40" : /M40/i.test(income) ? "m40" : /T20/i.test(income) ? "t20" : null;
  if (!tier) return <span className="text-ink-4 text-[11.5px]">—</span>;
  return <span className={`ug-tier ${tier}`}>{tier.toUpperCase()}</span>;
}

function studentInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(/\s+/).map(p => p[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

function canBulkApprove(a: InboxApp): boolean {
  if (a.ai_recommendation !== "approve") return false;
  if ((a.ai_confidence ?? 0) < 0.7) return false;
  if (a.flags?.some(f => f.severity === "block")) return false;
  return true;
}

function ConfidenceLabel({ value }: { value: number }) {
  const { label, color } = confidenceTone(value);
  return (
    <div className="text-[11px] font-medium inline-flex items-baseline gap-1.5">
      <span style={{ color }}>{label}</span>
      <span className="text-ink-4 mono text-[10.5px]">{value.toFixed(2)}</span>
    </div>
  );
}

function confidenceTone(value: number): { label: string; color: string } {
  if (value >= 0.85) return { label: "Very confident", color: "var(--moss)" };
  if (value >= 0.70) return { label: "Confident", color: "var(--moss)" };
  if (value >= 0.50) return { label: "Borderline", color: "var(--amber)" };
  return { label: "Low confidence", color: "var(--crimson)" };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
