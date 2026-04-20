/**
 * GET /api/notifications
 *
 * Unified events feed for the current user. Pulled from raw rows on
 * applications + application_decisions + application_letters. No separate
 * notifications table — keeps the schema lean. Each event is { type, title,
 * subtitle, href, ts, app_id }.
 *
 * Students see events on their own applications.
 * Staff/admin see events on applications they own/claimed + recent submissions.
 */

import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/lib/utils/responses";

const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface Event {
  type: "status_change" | "letter" | "decision" | "new_submission" | "info_request";
  title: string;
  subtitle: string | null;
  href: string;
  ts: string;
  app_id: string;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return apiError("Not authenticated", 401);

  const sb = getServiceSupabase();
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
  const events: Event[] = [];

  if (user.role === "student") {
    const { data: apps } = await sb
      .from("applications")
      .select("id, status, updated_at, decided_at, procedure_id, procedures(name)")
      .eq("user_id", user.id)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(20);

    for (const a of apps ?? []) {
      const procName = (a.procedures as unknown as { name: string } | null)?.name ?? a.procedure_id;
      if (a.status === "approved") {
        events.push({
          type: "decision", title: "Application approved", subtitle: procName,
          href: `/student/applications/${a.id}`, ts: a.decided_at ?? a.updated_at, app_id: a.id,
        });
      } else if (a.status === "rejected") {
        events.push({
          type: "decision", title: "Application rejected", subtitle: procName,
          href: `/student/applications/${a.id}`, ts: a.decided_at ?? a.updated_at, app_id: a.id,
        });
      } else if (a.status === "more_info_requested") {
        events.push({
          type: "info_request", title: "Coordinator needs more info", subtitle: procName,
          href: `/student/applications/${a.id}`, ts: a.updated_at, app_id: a.id,
        });
      } else if (a.status === "under_review" || a.status === "submitted") {
        events.push({
          type: "status_change", title: `Application ${a.status.replace(/_/g, " ")}`, subtitle: procName,
          href: `/student/applications/${a.id}`, ts: a.updated_at, app_id: a.id,
        });
      }
    }

    const { data: letters } = await sb
      .from("application_letters")
      .select("id, application_id, letter_type, created_at, applications!inner(user_id, procedure_id, procedures(name))")
      .eq("applications.user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    for (const l of (letters ?? []) as unknown as Array<{
      application_id: string; letter_type: string; created_at: string;
      applications: { procedure_id: string; procedures?: { name: string } };
    }>) {
      events.push({
        type: "letter",
        title: `${l.letter_type.replace(/_/g, " ")} letter received`,
        subtitle: l.applications?.procedures?.name ?? l.applications?.procedure_id ?? null,
        href: `/student/applications/${l.application_id}`,
        ts: l.created_at,
        app_id: l.application_id,
      });
    }
  } else {
    // staff or admin
    const { data: newApps } = await sb
      .from("applications")
      .select("id, user_id, procedure_id, status, submitted_at, procedures(name)")
      .gte("submitted_at", since)
      .in("status", ["submitted", "more_info_requested"])
      .order("submitted_at", { ascending: false })
      .limit(15);

    // Student names — separate query since there's no direct FK to student_profiles
    const appUserIds = [...new Set((newApps ?? []).map((a) => a.user_id))];
    const { data: appStudents } = appUserIds.length
      ? await sb.from("student_profiles").select("user_id, full_name").in("user_id", appUserIds)
      : { data: [] };
    const studentNameByUserId = new Map((appStudents ?? []).map((p) => [p.user_id, p.full_name]));

    for (const a of (newApps ?? []) as unknown as Array<{
      id: string; user_id: string; procedure_id: string; status: string; submitted_at: string;
      procedures?: { name: string };
    }>) {
      if (!a.submitted_at) continue;
      events.push({
        type: "new_submission",
        title: `New submission · ${studentNameByUserId.get(a.user_id) ?? "Student"}`,
        subtitle: a.procedures?.name ?? a.procedure_id,
        href: `/coordinator/applications/${a.id}`,
        ts: a.submitted_at,
        app_id: a.id,
      });
    }

    const { data: decisions } = await sb
      .from("application_decisions")
      .select("id, application_id, decision, decided_at, applications!inner(user_id, procedure_id, procedures(name))")
      .eq("decided_by", user.id)
      .gte("decided_at", since)
      .order("decided_at", { ascending: false })
      .limit(10);

    const decisionUserIds = [...new Set(((decisions ?? []) as unknown as Array<{ applications: { user_id: string } }>)
      .map((d) => d.applications?.user_id).filter((x): x is string => typeof x === "string"))];
    const { data: decisionStudents } = decisionUserIds.length
      ? await sb.from("student_profiles").select("user_id, full_name").in("user_id", decisionUserIds)
      : { data: [] };
    const decisionNameByUserId = new Map((decisionStudents ?? []).map((p) => [p.user_id, p.full_name]));

    for (const d of (decisions ?? []) as unknown as Array<{
      application_id: string; decision: string; decided_at: string;
      applications: { user_id: string; procedure_id: string; procedures?: { name: string } };
    }>) {
      const studentName = decisionNameByUserId.get(d.applications?.user_id) ?? "";
      events.push({
        type: "decision",
        title: `You ${d.decision === "approve" ? "approved" : d.decision === "reject" ? "rejected" : d.decision === "withdrawn" ? "received withdrawal of" : "requested info on"} an application`,
        subtitle: `${studentName} · ${d.applications?.procedures?.name ?? d.applications?.procedure_id ?? ""}`,
        href: `/coordinator/applications/${d.application_id}`,
        ts: d.decided_at,
        app_id: d.application_id,
      });
    }
  }

  events.sort((a, b) => b.ts.localeCompare(a.ts));
  const trimmed = events.slice(0, 25);

  return apiSuccess({
    events: trimmed,
    server_time: new Date().toISOString(),
  });
}
