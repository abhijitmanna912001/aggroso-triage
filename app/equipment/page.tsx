import Link from "next/link";
import { Suspense } from "react";
import { listEquipmentOverview } from "@/lib/server/queries";
import { formatUtc } from "@/lib/ui/format";
import { Badge } from "../_components/ui/badge";
import { Card } from "../_components/ui/card";
import { EmptyState } from "../_components/ui/empty-state";
import { PageHeader } from "../_components/ui/page-header";
import { Skeleton } from "../_components/ui/skeleton";

const LINK = "text-accent underline underline-offset-2 hover:no-underline";

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading equipment" className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// Uncached read: it must stay inside <Suspense>. A failed query is not caught here, so it reaches app/error.tsx.
async function EquipmentList() {
  const equipment = await listEquipmentOverview();

  if (equipment.length === 0) {
    return <EmptyState title="No equipment found" description="Run the seed first." />;
  }

  return (
    <div>
      <Card className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">All equipment with report counts</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-2 pr-3">Tag</th>
              <th scope="col" className="py-2 pr-3">Name</th>
              <th scope="col" className="py-2 pr-3">Type</th>
              <th scope="col" className="py-2 pr-3">Reports</th>
              <th scope="col" className="py-2 pr-3">Open reports</th>
              <th scope="col" className="py-2">Last report</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((e) => (
              <tr key={e.id} className="border-b border-line align-top last:border-b-0">
                <td className="py-3 pr-3">
                  <Link href={`/equipment/${e.id}`} className={`${LINK} font-medium`}>
                    {e.tag}
                  </Link>
                </td>
                <td className="py-3 pr-3">{e.name}</td>
                <td className="py-3 pr-3">
                  <Badge tone="neutral">{e.type}</Badge>
                </td>
                <td className="py-3 pr-3">{e.reportCount}</td>
                <td className="py-3 pr-3">{e.openReportCount}</td>
                <td className="whitespace-nowrap py-3">
                  {e.latestReportAt === null ? "No reports yet" : formatUtc(e.latestReportAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="space-y-3 md:hidden">
        {equipment.map((e) => (
          <li key={e.id} className="rounded-lg border border-line bg-surface-raised p-4 text-sm shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/equipment/${e.id}`} className={`${LINK} font-medium`}>
                {e.tag}
              </Link>
              <Badge tone="neutral">{e.type}</Badge>
            </div>
            <p className="mt-1">{e.name}</p>
            <p className="mt-2">
              {e.reportCount} reports, {e.openReportCount} open
            </p>
            <p className="mt-1 text-muted">
              Last report: {e.latestReportAt === null ? "No reports yet" : formatUtc(e.latestReportAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <div>
      <PageHeader title="Equipment" />
      <Suspense fallback={<ListSkeleton />}>
        <EquipmentList />
      </Suspense>
    </div>
  );
}
