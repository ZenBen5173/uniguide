import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Library } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import TopBar from "@/components/shared/TopBar";
import LetterTemplateEditor from "@/components/admin/LetterTemplateEditor";
import DeadlineEditor from "@/components/admin/DeadlineEditor";

export default async function AdminProcedureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(["admin", "staff"]);
  if (!user) redirect(`/login?next=/admin/procedures/${id}`);

  const sb = getServiceSupabase();
  const [{ data: procedure }, { data: chunks }, { data: templates }, { data: profile }] = await Promise.all([
    sb.from("procedures").select("*").eq("id", id).maybeSingle(),
    sb.from("procedure_sop_chunks").select("id, chunk_order, section, content").eq("procedure_id", id).order("chunk_order"),
    sb.from("procedure_letter_templates").select("id, template_type, name, template_text, detected_placeholders, updated_at").eq("procedure_id", id).order("template_type"),
    sb.from("staff_profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!procedure) notFound();

  const name = profile?.full_name ?? user.email.split("@")[0];
  const initials = name.split(/\s+/).map((p: string) => p[0]?.toUpperCase() ?? "").slice(0, 2).join("") || "A";

  return (
    <>
      <TopBar
        user={{ name, initials, email: user.email }}
        roleChip={{ label: "Admin · UniGuide" }}
        nav={[
          { href: "/admin", label: "Procedures" },
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/glm-traces", label: "GLM traces" },
        ]}
      />

      <main className="mx-auto max-w-[1320px] px-8 pt-6 pb-16">
        <Link href="/admin" className="text-[13px] text-ink-4 hover:text-ink no-underline inline-flex items-center gap-1 mb-3">
          ← All procedures
        </Link>

        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-[26px] leading-[1.15] font-semibold tracking-tight m-0">
              {procedure.name}
            </h1>
            <div className="text-sm text-ink-3 mt-1.5 flex items-center gap-3">
              <span className="mono text-ink-2">{procedure.id}</span>
              <span className="w-1 h-1 rounded-full bg-ink-5" />
              <span>{chunks?.length ?? 0} SOP sections</span>
              <span className="w-1 h-1 rounded-full bg-ink-5" />
              <span>{templates?.length ?? 0} letter templates</span>
              {procedure.source_url && <>
                <span className="w-1 h-1 rounded-full bg-ink-5" />
                <a href={procedure.source_url} target="_blank" rel="noreferrer" className="text-crimson hover:underline">
                  Source ↗
                </a>
              </>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
          {/* SOP chunks */}
          <section className="ug-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-line-2 flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Library className="h-4 w-4 text-ink-3" strokeWidth={1.75} />
                Indexed SOP sections
              </div>
              <span className="text-[12px] text-ink-4 mono">{chunks?.length ?? 0} chunks · GLM uses these at every step</span>
            </div>
            <div className="max-h-[600px] overflow-auto">
              {(chunks ?? []).map((c) => (
                <div key={c.id} className="px-5 py-4 border-b border-line-2 last:border-b-0">
                  {c.section && (
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-ai-ink mb-1.5 mono">{c.section}</div>
                  )}
                  <p className="text-[13px] text-ink-2 leading-snug whitespace-pre-wrap m-0">{c.content}</p>
                </div>
              ))}
              {(!chunks || chunks.length === 0) && (
                <div className="px-5 py-8 text-center text-ink-4">
                  No SOP indexed yet. Upload one from the procedures library.
                </div>
              )}
            </div>
          </section>

          {/* Right rail: deadline + letter templates */}
          <aside className="space-y-4">
            <DeadlineEditor
              procedureId={id}
              initialDate={procedure.deadline_date ?? null}
              initialLabel={procedure.deadline_label ?? null}
            />
            <div className="ug-card overflow-hidden">
              <LetterTemplateEditor procedureId={id} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
