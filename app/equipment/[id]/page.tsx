import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReportStatusBadge, WorkOrderStatusBadge } from "@/app/_components/status-badge";
import { Badge } from "@/app/_components/ui/badge";
import { Card } from "@/app/_components/ui/card";
import { EmptyState } from "@/app/_components/ui/empty-state";
import { PageHeader } from "@/app/_components/ui/page-header";
import { Skeleton } from "@/app/_components/ui/skeleton";
import { getEquipmentHistory, getEquipmentReports } from "@/lib/server/queries";
import { formatUtc } from "@/lib/ui/format";
import { describeHistoryType, GROUP_LABELS, historyTone } from "@/lib/ui/history-view";

const LINK = "text-accent underline underline-offset-2 hover:no-underline";
const TH = "py-2 pr-3 whitespace-nowrap";
const TD = "py-3 pr-3";

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading equipment history" className="space-y-4">
      <Skeleton className="h-9 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// params and the database reads are request-time and uncached, so all of it happens here, under <Suspense>.
// A failed query is not caught, so it reaches app/error.tsx.
async function EquipmentHistory({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
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
      <PageHeader
        title={
          <>
            {equipment.tag} · {equipment.name}
          </>
        }
        description={<Badge tone="neutral">{equipment.type}</Badge>}
      />

      <section aria-labelledby="reported-issues">
        <Card>
          <h2 id="reported-issues" className="mb-3 font-semibold">
            Reported issues
          </h2>
          {reports.length === 0 ? (
            <EmptyState title="No reports for this equipment yet" />
          ) : (
            <div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Reports for {equipment.tag}, newest first</caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className={TH}>Report</th>
                      <th scope="col" className={TH}>Created</th>
                      <th scope="col" className={TH}>Reported by</th>
                      <th scope="col" className={TH}>Issue</th>
                      <th scope="col" className={TH}>Status</th>
                      <th scope="col" className="py-2 whitespace-nowrap">Work order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                        <td className={TD}>
                          <Link href={`/reports/${r.id}`} className={`${LINK} font-medium`}>
                            #{r.id}
                          </Link>
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{formatUtc(r.createdAt)}</td>
                        <td className={TD}>{r.reportedBy}</td>
                        <td className={TD}>{r.issue}</td>
                        <td className={TD}>
                          <div className="flex min-h-5 items-center">
                            <ReportStatusBadge status={r.status} />
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="flex min-h-5 items-center">
                            <WorkOrderStatusBadge status={r.workOrderStatus} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-md border border-line p-4 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/reports/${r.id}`} className={`${LINK} font-medium`}>
                        Report #{r.id}
                      </Link>
                      <span className="text-muted">{formatUtc(r.createdAt)}</span>
                    </div>
                    <p className="mt-1">{r.issue}</p>
                    <p className="mt-1 text-muted">Reported by {r.reportedBy}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ReportStatusBadge status={r.status} />
                      <WorkOrderStatusBadge status={r.workOrderStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </section>

      <section aria-labelledby="maintenance-history" className="mt-6">
        <Card>
          <h2 id="maintenance-history" className="mb-3 font-semibold">
            Maintenance history
          </h2>
          {entries.length === 0 ? (
            <EmptyState title="No history yet" />
          ) : (
            <ol className="ml-2 border-l border-line">
              {entries.map((entry) => {
                const { label, group } = describeHistoryType(entry.type);
                return (
                  <li key={entry.id} className="relative pb-6 pl-6 text-sm last:pb-0">
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 -left-1.25 size-2.5 rounded-full border border-line bg-muted"
                    />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <time dateTime={entry.createdAt.toISOString()} className="whitespace-nowrap text-muted">
                        {formatUtc(entry.createdAt)}
                      </time>
                      <Badge tone={historyTone(entry.type)}>{label}</Badge>
                      <span className="text-xs text-muted">{GROUP_LABELS[group]}</span>
                    </div>
                    <p className="mt-1 text-muted">By {entry.actor}</p>
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
          <p className="mt-4 text-sm text-muted">
            Showing the latest 100 entries. History is append-only: entries are never edited or deleted.
          </p>
        </Card>
      </section>
    </div>
  );
}

export default function EquipmentPage({ params }: PageProps<"/equipment/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EquipmentHistory params={params} />
    </Suspense>
  );
}
