import Link from "next/link";
import { Suspense } from "react";
import { listEquipmentOverview } from "@/lib/server/queries";
import { formatUtc } from "@/lib/ui/format";

const LINK = "underline underline-offset-2 hover:no-underline";

function Skeleton() {
  return (
    <div role="status" aria-label="Loading equipment" className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

// Uncached read: it must stay inside <Suspense>. A failed query is not caught here, so it reaches app/error.tsx.
async function EquipmentList() {
  const equipment = await listEquipmentOverview();

  if (equipment.length === 0) {
    return (
      <div className="rounded-md border border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="font-medium">No equipment found. Run the seed first.</p>
      </div>
    );
  }

  return (
    <div>
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">All equipment with report counts</caption>
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th scope="col" className="py-2 pr-3 font-medium">Tag</th>
            <th scope="col" className="py-2 pr-3 font-medium">Name</th>
            <th scope="col" className="py-2 pr-3 font-medium">Type</th>
            <th scope="col" className="py-2 pr-3 font-medium">Reports</th>
            <th scope="col" className="py-2 pr-3 font-medium">Open reports</th>
            <th scope="col" className="py-2 font-medium">Last report</th>
          </tr>
        </thead>
        <tbody>
          {equipment.map((e) => (
            <tr key={e.id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
              <td className="py-3 pr-3">
                <Link href={`/equipment/${e.id}`} className={`${LINK} font-medium`}>
                  {e.tag}
                </Link>
              </td>
              <td className="py-3 pr-3">{e.name}</td>
              <td className="py-3 pr-3">{e.type}</td>
              <td className="py-3 pr-3">{e.reportCount}</td>
              <td className="py-3 pr-3">{e.openReportCount}</td>
              <td className="whitespace-nowrap py-3">
                {e.latestReportAt === null ? "No reports yet" : formatUtc(e.latestReportAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 md:hidden">
        {equipment.map((e) => (
          <li key={e.id} className="rounded-md border border-zinc-300 p-4 text-sm dark:border-zinc-700">
            <Link href={`/equipment/${e.id}`} className={`${LINK} font-medium`}>
              {e.tag}
            </Link>
            <p className="mt-1">{e.name}</p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{e.type}</p>
            <p className="mt-2">
              {e.reportCount} reports, {e.openReportCount} open
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Equipment</h1>
      <Suspense fallback={<Skeleton />}>
        <EquipmentList />
      </Suspense>
    </div>
  );
}
