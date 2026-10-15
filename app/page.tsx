import Link from "next/link";
import { Suspense } from "react";
import { listRecentReports } from "@/lib/server/queries";
import { formatUtc } from "@/lib/ui/format";
import { ReportStatusBadge, WorkOrderStatusBadge } from "./_components/status-badge";
import { LinkButton } from "./_components/ui/button";
import { Card } from "./_components/ui/card";
import { EmptyState } from "./_components/ui/empty-state";
import { PageHeader } from "./_components/ui/page-header";
import { Skeleton } from "./_components/ui/skeleton";

const LINK = "text-accent underline underline-offset-2 hover:no-underline";

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading reports" className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// Uncached read: it must stay inside <Suspense>. A failed query is not caught here, so it reaches app/error.tsx.
async function ReportList() {
  const reports = await listRecentReports();

  if (reports.length === 0) {
    return (
      <EmptyState
        title="No reports yet"
        description="Reports you create will appear here."
        action={<LinkButton href="/reports/new">Create the first report</LinkButton>}
      />
    );
  }

  return (
    <div>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Most recent reports</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3">Report</th>
              <th scope="col" className="py-2 pr-3">Equipment</th>
              <th scope="col" className="py-2 pr-3">Issue</th>
              <th scope="col" className="py-2 pr-3">Reported</th>
              <th scope="col" className="py-2 pr-3">Report status</th>
              <th scope="col" className="py-2">Work order</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-line align-top last:border-b-0">
                <td className="py-3 pr-3">
                  <Link href={`/reports/${r.id}`} className={`${LINK} font-medium`}>
                    #{r.id}
                  </Link>
                </td>
                <td className="py-3 pr-3">
                  <span className="font-medium">{r.equipmentTag}</span>
                  <br />
                  <span className="text-muted">{r.equipmentName}</span>
                </td>
                <td className="py-3 pr-3">{r.issue}</td>
                <td className="py-3 pr-3">
                  {r.reportedBy}
                  <br />
                  <span className="whitespace-nowrap text-muted">{formatUtc(r.createdAt)}</span>
                </td>
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
      </Card>

      <ul className="space-y-3 md:hidden">
        {reports.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-surface-raised p-4 text-sm shadow-xs">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/reports/${r.id}`} className={`${LINK} font-medium`}>
                Report #{r.id}
              </Link>
              <span className="text-muted">{formatUtc(r.createdAt)}</span>
            </div>
            <p className="mt-1">
              <span className="font-medium">{r.equipmentTag}</span> {r.equipmentName}
            </p>
            <p className="mt-1">{r.issue}</p>
            <p className="mt-1 text-muted">Reported by {r.reportedBy}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ReportStatusBadge status={r.status} />
              <WorkOrderStatusBadge status={r.workOrderStatus} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-muted">Showing the 20 most recent reports</p>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <PageHeader title="Reports" actions={<LinkButton href="/reports/new">New report</LinkButton>} />
      <Suspense fallback={<ListSkeleton />}>
        <ReportList />
      </Suspense>
    </div>
  );
}
