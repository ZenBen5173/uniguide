/**
 * Placeholder for the Coordinator Inbox.
 * Final UI will be built from Claude Design mockups.
 */
import Link from "next/link";

export default function CoordinatorInboxPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">← Home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Coordinator Inbox</h1>
      <p className="mt-2 text-slate-600">
        UI is being rebuilt from Claude Design mockups. Backend ready.
      </p>

      <div className="mt-8 card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Console probe
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">{`// Inbox queue
fetch('/api/coordinator/inbox').then(r => r.json()).then(console.log)

// Decide on an application
fetch('/api/coordinator/applications/<APP_ID>/decide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ decision: 'approve' })
}).then(r => r.json()).then(console.log)`}</pre>
      </div>
    </div>
  );
}
