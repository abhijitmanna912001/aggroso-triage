import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportStatusBadge, WorkOrderStatusBadge } from "@/app/_components/status-badge";
import { getEquipmentHistory, getEquipmentReports } from "@/lib/server/queries";
import { formatUtc } from "@/lib/ui/format";
import { describeHistoryType, GROUP_LABELS } from "@/lib/ui/history-view";

const LINK = "underline underline-offset-2 hover:no-underline";
const MUTED = "text-zinc-600 dark:text-zinc-400";

function Skeleton() {
  return (
    <div role="status" aria-label="Loading equipment history" className="space-y-3">
      <div className="h-8 w-1/3 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

// params and the database reads are request-time and uncached, so all of it happens here, under <Suspense>.
// A failed query is not caught, so it reaches app/error.tsx.
async function EquipmentHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const equipmentId = /^[0-9]+$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(equipmentId) || equipmentId <= 0) notFound();

  const [history, reports] = await Promise.all([
    getEquipmentHistory(equipmentId, 100),
    getEquipmentReports(equipmentId),
  ]);
  if (history === null) notFound();
  const { equipment, entries } = history;

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {equipment.tag} · {equipment.name}
        </h1>
        <p className={`mt-2 text-sm ${MUTED}`}>Type: {equipment.type}</p>
      </header>

      <section aria-labelledby="reported-issues" className="mt-8">
        <h2 id="reported-issues" className="mb-3 text-lg font-semibold tracking-tight">
          Reported issues
        </h2>
        {reports.length === 0 ? (
          <div className="rounded-md border border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="font-medium">No reports for this equipment yet</p>
          </div>
        ) : (
          <div>
            <table className="hidden w-full text-left text-sm md:table">
              <caption className="sr-only">Reports for {equipment.tag}, newest first</caption>
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700">
                  <th scope="col" className="py-2 pr-3 font-medium">Report</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Created</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Reported by</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Issue</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Report status</th>
                  <th scope="col" className="py-2 font-medium">Work order</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                    <td className="py-3 pr-3">
                      <Link href={`/reports/${r.id}`} className={LINK}>
                        #{r.id}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">{formatUtc(r.createdAt)}</td>
                    <td className="py-3 pr-3">{r.reportedBy}</td>
                    <td className="py-3 pr-3">{r.issue}</td>
                    <td className="py-3 pr-3">
                      <ReportStatusBadge status={r.status} />
                    </td>
                    <td className="py-3">
                      <WorkOrderStatusBadge status={r.workOrderStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="space-y-3 md:hidden">
              {reports.map((r) => (
                <li key={r.id} className="rounded-md border border-zinc-300 p-4 text-sm dark:border-zinc-700">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/reports/${r.id}`} className={`${LINK} font-medium`}>
                      Report #{r.id}
                    </Link>
                    <span className={MUTED}>{formatUtc(r.createdAt)}</span>
                  </div>
                  <p className="mt-1">{r.issue}</p>
                  <p className={`mt-1 ${MUTED}`}>Reported by {r.reportedBy}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ReportStatusBadge status={r.status} />
                    <WorkOrderStatusBadge status={r.workOrderStatus} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="maintenance-history" className="mt-10">
        <h2 id="maintenance-history" className="mb-3 text-lg font-semibold tracking-tight">
          Maintenance history
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-md border border-zinc-300 p-6 text-center dark:border-zinc-700">
            <p className="font-medium">No history yet</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              const { label, group } = describeHistoryType(entry.type);
              return (
                <li key={entry.id} className="rounded-md border border-zinc-300 p-4 text-sm dark:border-zinc-700">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time dateTime={entry.createdAt.toISOString()} className={`whitespace-nowrap ${MUTED}`}>
                      {formatUtc(entry.createdAt)}
                    </time>
                    <span className="font-medium">{label}</span>
                    <span className="rounded-xs border border-zinc-500 px-1.5 py-0.5 text-xs text-zinc-800 dark:border-zinc-400 dark:text-zinc-200">
                      {GROUP_LABELS[group]}
                    </span>
                  </div>
                  <p className={`mt-1 ${MUTED}`}>By {entry.actor}</p>
                  <p className="mt-1 whitespace-pre-wrap">{entry.summary}</p>
                  {entry.reportId === null ? null : (
                    <p className="mt-2">
                      <Link href={`/reports/${entry.reportId}`} className={LINK}>
                        Report #{entry.reportId}
                      </Link>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <p className={`mt-4 text-sm ${MUTED}`}>
          Showing the latest 100 entries. History is append-only: entries are never edited or deleted.
        </p>
      </section>
    </div>
  );
}

export default function EquipmentPage({ params }: PageProps<"/equipment/[id]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <EquipmentHistory params={params} />
    </Suspense>
  );
}
