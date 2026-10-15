import Link from "next/link";
import { Suspense } from "react";
import { listRecentReports } from "@/lib/server/queries";
import { formatUtc } from "@/lib/ui/format";
import { ReportStatusBadge, WorkOrderStatusBadge } from "./_components/status-badge";

const LINK_BUTTON =
  "inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const LINK = "underline underline-offset-2 hover:no-underline";

function Skeleton() {
  return (
    <div role="status" aria-label="Loading reports" className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

// Uncached read: it must stay inside <Suspense>. A failed query is not caught here, so it reaches app/error.tsx.
async function ReportList() {
  const reports = await listRecentReports();

  if (reports.length === 0) {
    return (
      <div className="rounded-md border border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="font-medium">No reports yet</p>
        <p className="mt-2 text-sm">
          <Link href="/reports/new" className={LINK}>
            Create the first report
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">Most recent reports</caption>
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th scope="col" className="py-2 pr-3 font-medium">Report</th>
            <th scope="col" className="py-2 pr-3 font-medium">Equipment</th>
            <th scope="col" className="py-2 pr-3 font-medium">Issue</th>
            <th scope="col" className="py-2 pr-3 font-medium">Created</th>
            <th scope="col" className="py-2 pr-3 font-medium">Reported by</th>
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
              <td className="py-3 pr-3">
                <span className="font-medium">{r.equipmentTag}</span>
                <br />
                {r.equipmentName}
              </td>
              <td className="py-3 pr-3">{r.issue}</td>
              <td className="whitespace-nowrap py-3 pr-3">{formatUtc(r.createdAt)}</td>
              <td className="py-3 pr-3">{r.reportedBy}</td>
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
              <span className="text-zinc-600 dark:text-zinc-400">{formatUtc(r.createdAt)}</span>
            </div>
            <p className="mt-1">
              <span className="font-medium">{r.equipmentTag}</span> {r.equipmentName}
            </p>
            <p className="mt-1">{r.issue}</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">Reported by {r.reportedBy}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ReportStatusBadge status={r.status} />
              <WorkOrderStatusBadge status={r.workOrderStatus} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Showing the 20 most recent reports</p>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <Link href="/reports/new" className={LINK_BUTTON}>
          New report
        </Link>
      </div>
      <Suspense fallback={<Skeleton />}>
        <ReportList />
      </Suspense>
    </div>
  );
}
