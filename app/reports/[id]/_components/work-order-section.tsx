import { WorkOrderStatusBadge } from "@/app/_components/status-badge";
import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";

const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium";

const PRIORITY_LOOKS: Record<string, { glyph: string; classes: string }> = {
  LOW: { glyph: "▁", classes: "border-zinc-500 text-zinc-800 dark:border-zinc-400 dark:text-zinc-200" },
  MEDIUM: {
    glyph: "▃",
    classes: "border-blue-700 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100",
  },
  HIGH: {
    glyph: "▅",
    classes: "border-amber-700 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100",
  },
  URGENT: {
    glyph: "▇",
    classes: "border-red-700 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100",
  },
};

function PriorityBadge({ priority }: { priority: string }) {
  const look = PRIORITY_LOOKS[priority] ?? PRIORITY_LOOKS.LOW;
  return (
    <span className={`${BASE} ${look.classes}`}>
      <span aria-hidden="true">{look.glyph}</span>
      Priority: {priority}
    </span>
  );
}

function author(version: { source: string; editedBy: string | null }): string {
  return version.source === "AI" ? "AI" : (version.editedBy ?? "a technician");
}

export function WorkOrderSection({ workOrder }: { workOrder: Workspace["workOrder"] }) {
  const latest = workOrder?.versions[0] ?? null;
  const decided = workOrder !== null && (workOrder.status === "APPROVED" || workOrder.status === "REJECTED");

  return (
    <section id="work-order" aria-labelledby="work-order-heading" className="mt-10 scroll-mt-4">
      <h2 id="work-order-heading" className="text-xl font-semibold">Work order</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        The AI can only draft. Only a technician can approve or reject.
      </p>

      {workOrder === null || latest === null ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No work order has been drafted yet.</p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <div className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
            <div className="flex flex-wrap items-center gap-2">
              <WorkOrderStatusBadge status={workOrder.status} />
              <PriorityBadge priority={latest.priority} />
            </div>
            <h3 className="mt-3 font-medium whitespace-pre-wrap">{latest.title}</h3>
            <p className="mt-2 max-w-prose whitespace-pre-wrap">{latest.description}</p>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              Version {latest.versionNumber}, written by {author(latest)} · {formatUtc(latest.createdAt)}
            </p>
          </div>

          {decided ? (
            <div className="rounded-md border border-zinc-500 p-4 dark:border-zinc-400">
              <h3 className="font-medium">Decision</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="font-medium">Decided by</dt>
                <dd>{workOrder.decidedBy ?? "unknown"}</dd>
                <dt className="font-medium">Decided at</dt>
                <dd>{formatUtc(workOrder.decidedAt)}</dd>
                <dt className="font-medium">Version decided</dt>
                <dd>{workOrder.decidedVersion ?? "unknown"}</dd>
                <dt className="font-medium">Note</dt>
                <dd className="whitespace-pre-wrap">{workOrder.decisionNote ?? "No note"}</dd>
              </dl>
            </div>
          ) : null}

          <details className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
            <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              Version history ({workOrder.versions.length})
            </summary>
            <ol className="mt-3 space-y-3">
              {workOrder.versions.map((v) => (
                <li key={v.versionNumber} className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <p className="font-medium">
                    Version {v.versionNumber} · {v.source === "AI" ? "AI" : "Technician"}
                    {v.editedBy ? ` (${v.editedBy})` : ""}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">{formatUtc(v.createdAt)}</p>
                  <p className="mt-1">
                    <PriorityBadge priority={v.priority} />
                  </p>
                  <p className="mt-1 font-medium whitespace-pre-wrap">{v.title}</p>
                  <p className="whitespace-pre-wrap">{v.description}</p>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
