import { WorkOrderStatusBadge } from "@/app/_components/status-badge";
import { Card } from "@/app/_components/ui/card";
import type { Workspace } from "./evidence-chips";
import { PriorityBadge, versionAuthor } from "./work-order-section";

// Rail summary of the work order. Shown from lg only; the page hides it below that.
export function WorkOrderSummary({ workOrder }: { workOrder: Workspace["workOrder"] }) {
  const latest = workOrder?.versions[0] ?? null;
  return (
    <Card as="section" aria-labelledby="work-order-summary-heading" className="space-y-3 text-sm">
      <h2 id="work-order-summary-heading" className="text-base font-semibold">
        Work order
      </h2>
      {workOrder === null || latest === null ? (
        <>
          <p className="font-medium">No work order yet</p>
          <p className="text-muted">Run an analysis to get a draft, or write one by hand in the work order section.</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <WorkOrderStatusBadge status={workOrder.status} />
            <PriorityBadge priority={latest.priority} />
          </div>
          <p className="text-muted">
            Version {latest.versionNumber}, written by {versionAuthor(latest)}
          </p>
        </>
      )}
      <p>The AI can only draft. Only a technician can approve or reject.</p>
      <a href="#work-order" className="inline-block rounded-xs font-medium text-accent underline underline-offset-2 hover:no-underline">
        Go to the work order section
      </a>
    </Card>
  );
}
