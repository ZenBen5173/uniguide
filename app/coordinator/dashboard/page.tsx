"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BriefingCard from "@/components/admin/BriefingCard";

interface Briefing {
  id: string;
  workflow_id: string;
  extracted_facts: Record<string, unknown>;
  flags: Array<{ severity: string; message: string }>;
  recommendation: "approve" | "reject" | "request_info";
  reasoning: string;
  status: string;
  created_at: string;
}

export default function CoordinatorDashboardPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/admin/queue");
      const json = await res.json();
      if (!json.ok) {
        setError(json.error);
        return;
      }
      setBriefings(json.data.briefings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold">
            UniGuide
          </Link>
          <span className="text-sm text-slate-500">Coordinator dashboard</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Pending briefings</h1>
        <p className="mt-1 text-slate-600">
          Each card is a GLM-prepared summary of a student submission. Approve, reject, or request more info.
        </p>

        {loading && <p className="mt-6 text-slate-500">Loading…</p>}
        {error && <p className="mt-6 text-red-700">{error}</p>}

        {!loading && briefings.length === 0 && (
          <div className="mt-10 card p-10 text-center text-slate-500">
            🎉 Inbox zero. No pending submissions.
          </div>
        )}

        <ul className="mt-6 space-y-4">
          {briefings.map((b) => (
            <li key={b.id}>
              <BriefingCard briefing={b} onResolved={refresh} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
