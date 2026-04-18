/**
 * Placeholder for Coordinator's Application Detail page.
 */
import Link from "next/link";

export default async function CoordinatorAppDetailPlaceholder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/coordinator/inbox" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to inbox
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Application Detail</h1>
      <p className="mt-2 text-slate-600">
        Application <code className="rounded bg-slate-100 px-1.5">{id}</code>
      </p>
      <p className="mt-4 text-sm text-slate-500">
        UI is being rebuilt. Use <code className="rounded bg-slate-100 px-1.5">/api/coordinator/applications/{id}</code>
      </p>
    </div>
  );
}
