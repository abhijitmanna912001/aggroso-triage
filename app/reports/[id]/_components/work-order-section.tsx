import { WorkOrderStatusBadge } from "@/app/_components/status-badge";
import { Alert } from "@/app/_components/ui/alert";
import { Badge } from "@/app/_components/ui/badge";
import { Card } from "@/app/_components/ui/card";
import type { Tone } from "@/lib/ui/classes";
import { formatUtc } from "@/lib/ui/format";
import type { Workspace } from "./evidence-chips";
import { SectionHeader } from "./report-header";
import { ApprovePanel, EditWorkOrderForm, RejectPanel } from "./work-order-forms";

const PRIORITY_LOOKS: Record<string, { glyph: string; tone: Tone }> = {
  LOW: { glyph: "▁", tone: "neutral" },
  MEDIUM: { glyph: "▃", tone: "info" },
  HIGH: { glyph: "▅", tone: "warning" },
  URGENT: { glyph: "▇", tone: "danger" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const look = PRIORITY_LOOKS[priority] ?? PRIORITY_LOOKS.LOW;
  return (
    <Badge tone={look.tone} icon={<span aria-hidden="true">{look.glyph}</span>}>
      Priority: {priority}
    </Badge>
  );
}

export function versionAuthor(version: { source: string; editedBy: string | null }): string {
  return version.source === "AI" ? "AI" : (version.editedBy ?? "a technician");
}

export function WorkOrderSection({
  workOrder,
  reportId,
  signedIn,
}: {
  workOrder: Workspace["workOrder"];
  reportId: number;
  signedIn: boolean;
}) {
  const latest = workOrder?.versions[0] ?? null;
  const approved = workOrder?.status === "APPROVED";
  const decided = workOrder !== null && (approved || workOrder.status === "REJECTED");

  return (
    <Card as="section" id="work-order" aria-labelledby="work-order-heading" className="scroll-mt-20">
      <SectionHeader
        id="work-order-heading"
        title="Work order"
        description="The AI can only draft. Only a technician can approve or reject."
        count={workOrder?.versions.length}
      />

      {workOrder === null || latest === null ? (
        <p className="text-sm text-muted">No work order has been drafted yet.</p>
      ) : (
        <div className="space-y-4 text-sm">
          {decided ? (
            <Alert
              tone={approved ? "success" : "danger"}
              title={approved ? "This work order was approved" : "This work order was rejected"}
            >
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="font-medium">Decided by</dt>
                <dd>{workOrder.decidedBy ?? "unknown"}</dd>
                <dt className="font-medium">Decided at</dt>
                <dd>{formatUtc(workOrder.decidedAt)}</dd>
                <dt className="font-medium">Version decided</dt>
                <dd>{workOrder.decidedVersion ?? "unknown"}</dd>
                <dt className="font-medium">Note</dt>
                <dd className="whitespace-pre-wrap">{workOrder.decisionNote ?? "No note"}</dd>
              </dl>
              <p className="mt-2">This work order has been decided and can no longer be edited.</p>
            </Alert>
          ) : null}

          <div className="rounded-md border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <WorkOrderStatusBadge status={workOrder.status} />
              <PriorityBadge priority={latest.priority} />
            </div>
            <h3 className="mt-3 whitespace-pre-wrap">{latest.title}</h3>
            <p className="mt-1 text-muted">
              Version {latest.versionNumber}, written by {versionAuthor(latest)} · {formatUtc(latest.createdAt)}
            </p>
            <div
              role="region"
              aria-label="Work order description"
              tabIndex={0}
              className="mt-3 max-h-72 overflow-y-auto rounded-md border border-line bg-surface p-3 whitespace-pre-wrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {latest.description}
            </div>
          </div>

          {decided ? null : (
            <div className="space-y-4">
              <EditWorkOrderForm
                key={latest.versionNumber}
                reportId={reportId}
                signedIn={signedIn}
                expectedVersion={latest.versionNumber}
                initial={{ title: latest.title, description: latest.description, priority: latest.priority }}
              />
              <div className="grid gap-4 md:grid-cols-2 md:items-start">
                <ApprovePanel reportId={reportId} signedIn={signedIn} expectedVersion={latest.versionNumber} />
                <RejectPanel reportId={reportId} signedIn={signedIn} expectedVersion={latest.versionNumber} />
              </div>
            </div>
          )}

          <details className="rounded-md border border-line p-4">
            <summary className="cursor-pointer rounded-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Version history ({workOrder.versions.length})
            </summary>
            <ol className="mt-3 space-y-3">
              {workOrder.versions.map((v) => (
                <li key={v.versionNumber} className="border-t border-line pt-3">
                  <p className="font-medium">
                    Version {v.versionNumber} · {v.source === "AI" ? "AI" : "Technician"}
                    {v.editedBy ? ` (${v.editedBy})` : ""}
                  </p>
                  <p className="text-muted">{formatUtc(v.createdAt)}</p>
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
    </Card>
  );
}
