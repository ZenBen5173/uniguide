/**
 * Placeholder for the Student Portal home.
 * Final UI will be built from Claude Design mockups.
 */
import Link from "next/link";

export default function StudentPortalPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Student Portal</h1>
      <p className="mt-2 text-slate-600">
        UI is being rebuilt from Claude Design mockups. Backend is live —
        you can interact with the new APIs from the browser console.
      </p>

      <div className="mt-8 card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Try it from the console
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{`// 1. List your applications
fetch('/api/applications').then(r => r.json()).then(console.log)

// 2. Start a new application
fetch('/api/applications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ procedure_id: 'scholarship_application' })
}).then(r => r.json()).then(console.log)

// 3. Respond to a step (use step_id from the previous response)
fetch('/api/applications/<APP_ID>/respond', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    step_id: '<STEP_ID>',
    response_data: { monthly_income_rm: 3500, cgpa: 3.10, bumiputera_status: 'No' }
  })
}).then(r => r.json()).then(console.log)`}</pre>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Mock mode is active — GLM responses come from canned fixtures. Each step you
        respond to will reveal the next step in the demo Yayasan UM scholarship flow.
      </p>
    </div>
  );
}
