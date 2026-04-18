/**
 * Placeholder for the Smart Application page.
 * Final UI will be built from Claude Design mockups.
 */
import Link from "next/link";

export default async function ApplicationPlaceholder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/student/portal" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to portal
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Application</h1>
      <p className="mt-2 text-slate-600">
        Application <code className="rounded bg-slate-100 px-1.5">{id}</code>
      </p>
      <p className="mt-4 text-sm text-slate-500">
        UI is being rebuilt. Use <code className="rounded bg-slate-100 px-1.5">/api/applications/{id}</code> to fetch details.
      </p>
    </div>
  );
}
