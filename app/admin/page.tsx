/**
 * Placeholder for Admin Procedures Library.
 */
import Link from "next/link";

export default function AdminPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Admin · Procedures</h1>
      <p className="mt-2 text-slate-600">
        UI is being rebuilt from Claude Design mockups.
      </p>

      <div className="mt-8 card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Console probe
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{`// List procedures + meta
fetch('/api/admin/procedures').then(r => r.json()).then(console.log)

// Replace SOP for a procedure
fetch('/api/admin/procedures/scholarship_application/sop', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source_text: '# Yayasan UM Scholarship\\n\\n## Eligibility\\n\\nMust be ...',
    source_url: 'https://hep.um.edu.my/scholarship'
  })
}).then(r => r.json()).then(console.log)

// List letter templates
fetch('/api/admin/procedures/scholarship_application/letter-templates')
  .then(r => r.json()).then(console.log)`}</pre>
      </div>
    </div>
  );
}
