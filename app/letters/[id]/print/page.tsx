import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getServiceSupabase } from "@/lib/supabase/server";
import PrintTrigger from "@/components/shared/PrintTrigger";

export default async function LetterPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!user) redirect(`/login?next=/letters/${id}/print`);

  const sb = getServiceSupabase();
  const { data: letter } = await sb
    .from("application_letters")
    .select(`
      id, letter_type, generated_text, created_at, delivered_to_student_at,
      applications!inner (
        id, user_id, procedure_id,
        procedures (name),
        student_profiles!applications_user_id_fkey (full_name, matric_no, faculty)
      )
    `)
    .eq("id", id)
    .single();

  if (!letter) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = (letter as any).applications;
  const isOwner = app.user_id === user.id;
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isOwner && !isStaff) notFound();

  const sp = app.student_profiles;
  const procName = app.procedures?.name ?? app.procedure_id;
  const dateLabel = new Date(letter.delivered_to_student_at ?? letter.created_at).toLocaleDateString("en-MY", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      <style>{`
        @page { margin: 22mm 18mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-body { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>
      <main className="min-h-screen bg-paper-2 px-4 py-8 print:bg-white print:px-0 print:py-0">
        <div className="no-print mx-auto max-w-[820px] mb-4 flex items-center justify-between">
          <a href={isStaff ? `/coordinator/applications/${app.id}` : `/student/applications/${app.id}`} className="text-[13px] text-ink-3 hover:text-ink no-underline">
            ← Back to application
          </a>
          <PrintTrigger />
        </div>

        <article className="print-body mx-auto max-w-[820px] bg-white border border-line-2 rounded-[6px] shadow-ug-card px-12 py-14 print:max-w-none print:shadow-none print:border-0 print:px-0 print:py-0">
          <header className="mb-8 flex items-start justify-between gap-6 border-b border-ink/10 pb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-crimson mb-1">Universiti Malaya</div>
              <div className="text-[14px] font-semibold text-ink-2">{procName}</div>
              <div className="text-[12px] text-ink-4 mt-1 capitalize">{letter.letter_type.replace(/_/g, " ")} letter</div>
            </div>
            <div className="text-right text-[12px] text-ink-3">
              <div>Reference</div>
              <div className="mono text-ink-2 font-semibold">UG-{letter.id.slice(0, 8).toUpperCase()}</div>
              <div className="mt-2">{dateLabel}</div>
            </div>
          </header>

          {sp && (
            <div className="mb-6 text-[12.5px] text-ink-3">
              <div className="font-semibold text-ink-2">{sp.full_name}</div>
              {sp.matric_no && <div className="mono">{sp.matric_no}</div>}
              {sp.faculty && <div>{sp.faculty}</div>}
            </div>
          )}

          <pre className="text-[14px] leading-[1.65] text-ink whitespace-pre-wrap font-sans m-0">
            {letter.generated_text}
          </pre>

          <footer className="mt-12 pt-6 border-t border-ink/10 text-[10.5px] text-ink-4 leading-relaxed">
            Generated and delivered electronically via UniGuide on {dateLabel}.
            For queries, contact the issuing office through your UniGuide portal.
          </footer>
        </article>
      </main>
    </>
  );
}
