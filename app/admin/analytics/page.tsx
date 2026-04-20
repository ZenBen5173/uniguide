/**
 * Admin analytics page — operational health snapshot for the procedures
 * library. Pulled from raw counts on applications + decisions; nothing
 * derived, no charts library, no fluff.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import TopBar from "@/components/shared/TopBar";

export default async function AdminAnalyticsPage() {
  const user = await requireRole(["admin", "staff"]);
  if (!user) redirect("/login?next=/admin/analytics");

  const sb = getServiceSupabase();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: allApps, count: totalApps },
    { data: thisWeekApps },
    { data: lastWeekApps },
    { data: procedures },
    { data: profile },
  ] = await Promise.all([
    sb.from("applications").select("id, status, procedure_id, submitted_at, decided_at, created_at", { count: "exact" }),
    sb.from("applications").select("id, status").gte("created_at", sevenDaysAgo),
    sb.from("applications").select("id").gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo),
    sb.from("procedures").select("id, name"),
    sb.from("staff_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ]);

  const apps = allApps ?? [];
  const procMap = new Map((procedures ?? []).map((p) => [p.id, p.name]));

  const byStatus = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const byProcedure = Array.from(procMap.entries()).map(([id, name]) => {
    const procApps = apps.filter((a) => a.procedure_id === id);
    return {
      id,
      name,
      total: procApps.length,
      pending: procApps.filter((a) => ["submitted", "under_review", "more_info_requested"].includes(a.status)).length,
      approved: procApps.filter((a) => a.status === "approved").length,
      rejected: procApps.filter((a) => a.status === "rejected").length,
    };
  }).sort((a, b) => b.total - a.total);

  // Avg decision time across decided apps in days.
  const decided = apps.filter((a) => a.submitted_at && a.decided_at);
  const avgDecisionMs = decided.length
    ? decided.reduce((sum, a) => sum + (new Date(a.decided_at!).getTime() - new Date(a.submitted_at!).getTime()), 0) / decided.length
    : null;
  const avgDecisionLabel = avgDecisionMs === null
    ? "—"
    : avgDecisionMs < 60 * 60_000
      ? `${Math.round(avgDecisionMs / 60_000)} min`
      : avgDecisionMs < 24 * 3600_000
        ? `${(avgDecisionMs / 3600_000).toFixed(1)} h`
        : `${(avgDecisionMs / (24 * 3600_000)).toFixed(1)} d`;

  const thisWeek = thisWeekApps?.length ?? 0;
  const lastWeek = lastWeekApps?.length ?? 0;
  const wow = lastWeek === 0 ? null : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

  const name = profile?.full_name ?? user.email.split("@")[0];
  const initials = name.split(/\s+/).map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "A";

  return (
    <>
      <TopBar
        user={{ name, initials, email: user.email }}
        roleChip={{ label: "Admin · UniGuide" }}
        nav={[
          { href: "/admin", label: "Procedures" },
          { href: "/admin/analytics", label: "Analytics", active: true },
          { href: "/admin/glm-traces", label: "GLM traces" },
        ]}
      />

      <main className="mx-auto max-w-[1320px] px-8 pt-6 pb-16">
        <div className="mb-6">
          <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight m-0">
            Analytics <span className="serif italic font-normal text-ink-2">— operations snapshot</span>
          </h1>
          <p className="text-sm text-ink-3 mt-1">
            Where the queue is, what's been decided, and how fast we're moving. Refreshed live on page load.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Kpi k="Total applications" v={String(totalApps ?? 0)} sub={`${thisWeek} this week${wow !== null ? ` · ${wow > 0 ? "+" : ""}${wow}% vs last` : ""}`} />
          <Kpi k="Pending review" v={String((byStatus.submitted ?? 0) + (byStatus.under_review ?? 0))} sub="awaiting coordinator" />
          <Kpi k="Approved" v={String(byStatus.approved ?? 0)} sub={`${apps.length === 0 ? 0 : Math.round(((byStatus.approved ?? 0) / apps.length) * 100)}% of decided`} ai />
          <Kpi k="Avg decision time" v={avgDecisionLabel} sub={`across ${decided.length} decided`} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* By procedure table */}
          <div className="ug-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2 flex items-center justify-between">
              <div className="text-sm font-semibold">By procedure</div>
              <span className="text-[12px] text-ink-4 mono">{byProcedure.length} total</span>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-semibold text-ink-4 uppercase tracking-wider px-4 py-2.5 bg-paper-2 border-b border-line">Procedure</th>
                  <th className="text-right text-[11px] font-semibold text-ink-4 uppercase tracking-wider px-3 py-2.5 bg-paper-2 border-b border-line">Total</th>
                  <th className="text-right text-[11px] font-semibold text-ink-4 uppercase tracking-wider px-3 py-2.5 bg-paper-2 border-b border-line">Pending</th>
                  <th className="text-right text-[11px] font-semibold text-ink-4 uppercase tracking-wider px-3 py-2.5 bg-paper-2 border-b border-line">Approved</th>
                  <th className="text-right text-[11px] font-semibold text-ink-4 uppercase tracking-wider px-3 py-2.5 bg-paper-2 border-b border-line">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {byProcedure.map((p) => (
                  <tr key={p.id} className="border-b border-line-2 last:border-b-0">
                    <td className="px-4 py-3 text-[13.5px]">
                      <Link href={`/admin/procedures/${p.id}`} className="text-ink hover:text-crimson no-underline font-medium">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right mono text-[13px] font-semibold text-ink-2">{p.total}</td>
                    <td className="px-3 py-3 text-right mono text-[13px] text-amber font-semibold">{p.pending || "—"}</td>
                    <td className="px-3 py-3 text-right mono text-[13px] text-moss font-semibold">{p.approved || "—"}</td>
                    <td className="px-3 py-3 text-right mono text-[13px] text-crimson font-semibold">{p.rejected || "—"}</td>
                  </tr>
                ))}
                {byProcedure.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-4 text-[13px]">
                      No procedures yet. Add one from the procedures library.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Status mix donut-ish */}
          <div className="ug-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2 text-sm font-semibold">Status mix</div>
            <div className="p-5">
              {Object.entries(byStatus).length === 0 ? (
                <div className="text-[13px] text-ink-4 text-center py-4">No applications yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                    const pct = apps.length === 0 ? 0 : (count / apps.length) * 100;
                    const tone = STATUS_TONE[status] ?? { color: "var(--ink-3)", bg: "var(--line-2)" };
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-[12.5px] mb-1">
                          <span className="capitalize text-ink-2 font-medium">{status.replace(/_/g, " ")}</span>
                          <span className="mono text-ink-3">{count} <span className="text-ink-4">· {pct.toFixed(0)}%</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-line-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

const STATUS_TONE: Record<string, { color: string; bg: string }> = {
  draft: { color: "var(--ink-4)", bg: "var(--line-2)" },
  submitted: { color: "var(--amber)", bg: "var(--amber-soft)" },
  under_review: { color: "var(--amber)", bg: "var(--amber-soft)" },
  more_info_requested: { color: "var(--crimson)", bg: "var(--crimson-soft)" },
  approved: { color: "var(--moss)", bg: "var(--moss-soft)" },
  rejected: { color: "var(--crimson)", bg: "var(--crimson-soft)" },
  withdrawn: { color: "var(--ink-4)", bg: "var(--line-2)" },
};

function Kpi({ k, v, sub, ai = false }: { k: string; v: string; sub?: string; ai?: boolean }) {
  return (
    <div className={`rounded-[10px] px-4 py-3 border ${ai ? "border-ai-line bg-ai-tint" : "border-line bg-card"}`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-4">{k}</div>
      <div className={`text-[22px] font-semibold mt-1 leading-none ${ai ? "text-ai-ink" : "text-ink"}`}>{v}</div>
      {sub && <div className="text-[11.5px] text-ink-4 mt-1.5">{sub}</div>}
    </div>
  );
}
