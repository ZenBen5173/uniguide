"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/shared/TopBar";

interface InboxApp {
  id: string;
  user_id: string;
  procedure_id: string;
  status: string;
  ai_recommendation: "approve" | "reject" | "request_info" | null;
  ai_confidence: number | null;
  student_summary: string | null;
  submitted_at: string | null;
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

interface Counts { pending: number; approved: number; rejected: number; more_info: number }

const FILTER_TABS = [
  { key: "pending", label: "Pending" },
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "more_info_requested", label: "Needs me" },
];

export default function CoordinatorInbox({ user }: { user: { name: string; initials: string; email?: string } }) {
  const router = useRouter();
  const [filter, setFilter] = useState("pending");
  const [apps, setApps] = useState<InboxApp[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0, more_info: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coordinator/inbox?status=${filter}`);
      const json = await res.json();
      if (json.ok) {
        setApps(json.data.applications);
        setCounts(json.data.counts);
        setSelected(new Set());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [filter]);

  // Sort: AI urgency first (low confidence + flags), then submitted_at desc.
  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      const urgentA = (a.flags?.some(f => f.severity === "block") ? 2 : 0) + (a.ai_confidence !== null && a.ai_confidence < 0.7 ? 1 : 0);
      const urgentB = (b.flags?.some(f => f.severity === "block") ? 2 : 0) + (b.ai_confidence !== null && b.ai_confidence < 0.7 ? 1 : 0);
      if (urgentA !== urgentB) return urgentB - urgentA;
      return (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "");
    });
  }, [apps]);

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

  const eligibleForBulk = sorted.filter(canBulkApprove);
  const excludedFromBulk = sorted.length - eligibleForBulk.length;

  return (
    <>
      <TopBar
        user={user}
        roleChip={{ label: "Coordinator · Yayasan UM" }}
        nav={[
          { href: "/coordinator/inbox", label: "Inbox", active: true },
          { href: "/coordinator/inbox", label: "Decided" },
        ]}
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
              className="flex-1 border-0 outline-none bg-transparent text-sm text-ink"
              placeholder="Search by student, matric, scholarship…"
            />
            <span className="font-mono text-[11px] px-1.5 py-0.5 border border-line rounded text-ink-4 bg-paper-2">⌘K</span>
          </div>
          <div className="flex gap-1.5 flex-1">
            {FILTER_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border ${
                  filter === t.key
                    ? "bg-card border-line text-ink"
                    : "bg-transparent border-transparent text-ink-3 hover:bg-[rgba(11,37,69,.04)]"
                }`}
              >
                {t.label}
                {t.key === "pending" && (
                  <span className={`mono text-[11px] px-1.5 rounded ${
                    filter === "pending" ? "bg-ink text-white" : "bg-line-2 text-ink-3"
                  }`}>{counts.pending}</span>
                )}
                {t.key === "more_info_requested" && counts.more_info > 0 && (
                  <span className="mono text-[11px] px-1.5 rounded bg-crimson text-white">{counts.more_info}</span>
                )}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-ai-line bg-ai-tint text-[13px] font-medium text-ai-ink">
            <span className="opacity-70">Sort</span> AI urgency
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
                onClick={bulkApprove}
                disabled={bulkBusy}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium bg-white text-ink border border-white"
              >
                {bulkBusy ? "Approving…" : `Approve ${selected.size} selected`}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="ug-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-ink-4">Loading inbox…</div>
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
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const isSelected = selected.has(a.id);
                  const isUrgent = a.flags?.some(f => f.severity === "block") || (a.ai_confidence !== null && a.ai_confidence < 0.7);
                  const isBulkable = canBulkApprove(a);
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-line-2 hover:bg-paper-2 transition cursor-pointer ${isSelected ? "bg-[#F1F2F6]" : ""} ${isUrgent ? "[background:linear-gradient(90deg,rgba(161,37,58,.04),transparent_140px)]" : ""}`}
                      onClick={() => router.push(`/coordinator/applications/${a.id}`)}
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
                            <div className="font-semibold text-ink text-[13.5px]">
                              {a.student_profiles?.full_name ?? "Unknown student"}
                            </div>
                            <div className="text-[11.5px] text-ink-4 mt-0.5 flex items-center gap-1.5">
                              <span className="mono">{a.procedures?.name ?? a.procedure_id}</span>
                              {a.student_profiles?.faculty && <>
                                <span className="w-[3px] h-[3px] rounded-full bg-ink-5" />
                                <span>{a.student_profiles.faculty}</span>
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
                          <div>
                            <span className={`ug-rec ${a.ai_recommendation === "approve" ? "approve" : a.ai_recommendation === "reject" ? "reject" : "review"}`}>
                              {a.ai_recommendation === "approve" ? "Approve" : a.ai_recommendation === "reject" ? "Reject" : "Review"}
                            </span>
                            {a.ai_confidence !== null && (
                              <div className="text-[10.5px] text-ink-4 mono mt-1 font-medium">
                                conf {a.ai_confidence.toFixed(2)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-[12.5px] text-ink-4">
                        {a.submitted_at ? relativeTime(a.submitted_at) : "—"}
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
